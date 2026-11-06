import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { checkoutProducts } from './testFixtures';

const orderRequests: { authorization?: string; body: unknown }[] = [];
const discountLookups: string[] = [];
const basketAdds: unknown[] = [];
const selectedItems = [
  { productID: 4, quantity: 1 },
  { productID: 12, quantity: 2 },
];
let basketItems = selectedItems.map((item) => ({ ...item }));
let basketStatus = 200;
let addStatus = 201;

function createFakeBackend() {
  const backend = express();
  backend.use(express.json());
  const customerFor = (authorization: string | undefined) =>
    authorization?.match(/^Bearer customer-(\d+)$/)?.[1];

  backend.get('/me', (req, res) => {
    const customerId = customerFor(req.get('authorization'));
    if (!customerId) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    res.json({ customerId: Number(customerId), role: 'customer' });
  });
  backend.get('/products', (_req, res) => {
    res.json({ products: checkoutProducts });
  });
  backend.get('/products/:id', (req, res) => {
    const product = checkoutProducts.find(
      (product) => product.productID === Number(req.params.id),
    );
    if (!product) {
      res.sendStatus(404);
      return;
    }
    res.json({ product });
  });
  backend.get('/basket/:customerID', (req, res) => {
    if (customerFor(req.get('authorization')) !== req.params.customerID) {
      res.sendStatus(403);
      return;
    }
    res.status(basketStatus).json({
      basket: basketItems.map((item, index) => ({
        ...item,
        basketID: index + 1,
        product: checkoutProducts.find(
          (product) => product.productID === item.productID,
        ),
      })),
    });
  });
  backend.post('/basket', (req, res) => {
    basketAdds.push(req.body);
    if (addStatus !== 201) {
      res.status(addStatus).json({ error: 'Could not add product' });
      return;
    }
    basketItems.push({
      productID: req.body.productID,
      quantity: req.body.quantity,
    });
    res.status(201).json({ basketID: 3, ...req.body });
  });
  backend.get('/customers/me/address', (req, res) => {
    if (customerFor(req.get('authorization')) === '4') {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.json({ address: { address: '123 Town Street', postcode: 'BT16 AAA' } });
  });
  backend.get('/discounts/:code', (req, res) => {
    discountLookups.push(req.params.code);
    if (req.params.code.trim().toUpperCase() !== 'FRIENDSHIP12') {
      res.status(404).json({ error: 'Invalid discount code' });
      return;
    }
    res.json({ discount: { code: 'FRIENDSHIP12', percentOff: 12 } });
  });
  backend.post('/orders', (req, res) => {
    const authorization = req.get('authorization');
    orderRequests.push({
      ...(authorization ? { authorization } : {}),
      body: req.body,
    });
    const customerId = customerFor(authorization);
    if (customerId === '5') {
      res
        .status(409)
        .json({ error: 'Not enough stock for product 4', productID: 4 });
      return;
    }
    if (customerId === '7') {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    res.status(201).json({
      order: {
        orderID: 42,
        customerID: Number(customerId),
        dateCreated: '2026-11-05T22:00:00.000Z',
        status: 'pending',
        address: req.body.address ?? '123 Town Street',
        postcode: req.body.postcode ?? 'BT16 AAA',
        discountCode: req.body.discountCode ?? null,
        discountAmount: req.body.discountCode ? 21.6 : 0,
        orderServices: [],
      },
    });
  });
  return backend;
}

async function listen(app: express.Express): Promise<[Server, string]> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return [server, `http://127.0.0.1:${port}`];
}

const VALID_FORM = {
  firstName: 'John',
  surname: 'Doe',
  deliveryOption: 'home',
  cardNumber: '4242 4242 4242 4242',
  expiryDate: '12/99',
  cvv: '123',
};

describe('checkout', () => {
  let backendServer: Server;
  let frontendServer: Server;
  let baseUrl: string;
  const originalBackendUrl = process.env.BACKEND_URL;

  const cookie = (customerId: number) => `access_token=customer-${customerId}`;

  const get = (customerId = 3) =>
    fetch(`${baseUrl}/checkout`, {
      headers: { cookie: cookie(customerId) },
      redirect: 'manual',
    });

  const post = (form: Record<string, string>, customerId = 3) =>
    fetch(`${baseUrl}/checkout`, {
      method: 'POST',
      headers: {
        cookie: cookie(customerId),
        'content-type': 'application/x-www-form-urlencoded',
        origin: baseUrl,
      },
      body: new URLSearchParams(form).toString(),
      redirect: 'manual',
    });

  beforeAll(async () => {
    let backendUrl: string;
    [backendServer, backendUrl] = await listen(createFakeBackend());
    process.env.BACKEND_URL = backendUrl;
    [frontendServer, baseUrl] = await listen(createApp());
  });

  beforeEach(() => {
    orderRequests.length = 0;
    discountLookups.length = 0;
    basketAdds.length = 0;
    basketItems = selectedItems.map((item) => ({ ...item }));
    basketStatus = 200;
    addStatus = 201;
  });

  afterAll(async () => {
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalBackendUrl;
    }
    for (const server of [frontendServer, backendServer]) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  describe('browse to basket', () => {
    const add = (quantity: string, id = '12', auth = cookie(3)) =>
      fetch(`${baseUrl}/products/${id}/add-to-basket`, {
        method: 'POST',
        headers: {
          cookie: auth,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ quantity }),
        redirect: 'manual',
      });

    it('submits the selected quantity and returns to browse with a working checkout link', async () => {
      const details = await (await fetch(`${baseUrl}/products/12`)).text();
      expect(details).toMatch(
        /<form method="post" action="\/products\/12\/add-to-basket">[\s\S]*name="quantity"/,
      );
      const response = await add('3');
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/product_browse');
      expect(basketAdds).toEqual([
        { customerID: 3, productID: 12, quantity: 3 },
      ]);
      const basket = await (
        await fetch(`${baseUrl}/basket`, { headers: { cookie: cookie(3) } })
      ).text();
      expect(basket).toContain('Quantity: 3');
      expect(basket).toContain('href="/checkout" id="checkout"');
      expect(await (await get()).text()).toContain('Catan × 3');
    });

    it.each(['0', '-1', '1.5', '', 'abc', '9007199254740992'])(
      'rejects invalid quantity %j without adding',
      async (quantity) => {
        expect((await add(quantity)).status).toBe(400);
        expect(basketAdds).toHaveLength(0);
      },
    );

    it('rejects invalid product IDs and quantities exceeding stock', async () => {
      expect((await add('1', 'invalid')).status).toBe(400);
      expect((await add('16')).status).toBe(409);
      expect(basketAdds).toHaveLength(0);
    });

    it('requires login before adding products', async () => {
      const response = await add('3', '12', '');
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('/login?returnTo=');
      expect(basketAdds).toHaveLength(0);
    });

    it('does not redirect as successful when adding fails', async () => {
      addStatus = 409;
      const response = await add('3');
      expect(response.status).toBe(409);
      expect(response.headers.get('location')).toBeNull();
      const html = await response.text();
      expect(html).toContain('Unable to add this product');
      expect(html).toContain('value="3"');
    });

    it('keeps checkout disabled when the basket is empty or unavailable', async () => {
      basketItems = [];
      let html = await (
        await fetch(`${baseUrl}/basket`, { headers: { cookie: cookie(3) } })
      ).text();
      expect(html).toContain('id="checkout" disabled');
      basketStatus = 500;
      html = await (
        await fetch(`${baseUrl}/basket`, { headers: { cookie: cookie(3) } })
      ).text();
      expect(html).toContain('id="checkout" disabled');
      expect(html).not.toContain('href="/checkout"');
    });
  });

  describe('GET /checkout', () => {
    it('summarises the customer basket using its product names, quantities and prices', async () => {
      const response = await get();
      const page = await response.text();

      expect(response.status).toBe(200);
      expect(page).toContain('Furby × 1');
      expect(page).toContain('£99.99');
      expect(page).toContain('Catan × 2');
      expect(page).toContain('£79.98');
      expect(page).toContain('Total: £179.97');
      expect(page).toMatch(/<button type="submit" class="checkout-button">/);
    });

    it('offers home or alternative address with neither pre-selected', async () => {
      const page = await (await get()).text();

      expect(page).toMatch(
        /<input id="delivery-home"[^>]*name="deliveryOption" value="home">/,
      );
      expect(page).toMatch(
        /<input id="delivery-other"[^>]*name="deliveryOption" value="other">/,
      );
      expect(page).not.toMatch(/name="deliveryOption"[^>]*checked/);
      expect(page).toContain('123 Town Street<br>BT16 AAA');
      expect(page).not.toContain('type="email"');
    });

    it('keeps address details hidden until an option is chosen', async () => {
      const css = await (await fetch(`${baseUrl}/styles/ecommerce.css`)).text();

      expect(css).toMatch(/\.delivery-panel \{\s*display: none;/);
      expect(css).toContain('#delivery-home:checked ~ #home-address-panel');
      expect(css).toContain('#delivery-other:checked ~ #other-address-panel');
    });

    it('disables the home option when the address cannot be loaded', async () => {
      const page = await (await get(4)).text();

      expect(page).toMatch(/<input id="delivery-home"[^>]*disabled>/);
      expect(page).toContain('Unable to load your home address.');
    });
  });

  describe('discount codes', () => {
    it('applies FRIENDSHIP12 and shows subtotal, discount and total', async () => {
      const response = await post({
        action: 'applyDiscount',
        firstName: 'John',
        discountCode: ' friendship12 ',
      });
      const page = await response.text();

      expect(response.status).toBe(200);
      expect(orderRequests).toHaveLength(0);
      expect(page).toMatch(/Subtotal<\/span>\s*<span>£179.97/);
      expect(page).toContain('Discount (FRIENDSHIP12, 12% off)');
      expect(page).toContain('−£21.60');
      expect(page).toContain('Total: £158.37');
      expect(page).toContain('FRIENDSHIP12 applied.');
      expect(page).toContain('value="FRIENDSHIP12"');
      expect(page).toContain('value="John"');
    });

    it('shows an error for an unknown code and keeps the full price', async () => {
      const response = await post({
        action: 'applyDiscount',
        discountCode: 'FREESTUFF',
      });
      const page = await response.text();

      expect(page).toContain('That discount code is not valid');
      expect(page).toContain('Total: £179.97');
      expect(page).not.toContain('id="checkout-discount"');
    });

    it('asks for a code when Apply is pressed with an empty box', async () => {
      const response = await post({
        action: 'applyDiscount',
        discountCode: '',
      });

      expect(await response.text()).toContain('Enter a discount code');
      expect(discountLookups).toHaveLength(0);
    });

    it('keeps Place Order as the default Enter action', async () => {
      const page = await (await get()).text();
      const defaultButton = page.indexOf('class="default-submit"');
      const applyButton = page.indexOf('value="applyDiscount"');

      expect(defaultButton).toBeGreaterThan(-1);
      expect(defaultButton).toBeLessThan(applyButton);
    });

    it('sends the code with the order', async () => {
      const response = await post({
        ...VALID_FORM,
        discountCode: 'friendship12',
      });

      expect(response.status).toBe(303);
      expect(orderRequests[0]?.body).toEqual({
        customerID: 3,
        discountCode: 'FRIENDSHIP12',
        orderServices: selectedItems,
      });
    });

    it('does not place an order with an invalid code', async () => {
      const response = await post({ ...VALID_FORM, discountCode: 'NOPE' });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain(
        'That discount code is not valid',
      );
      expect(orderRequests).toHaveLength(0);
    });

    it('keeps the discount applied when other fields fail validation', async () => {
      const response = await post({
        ...VALID_FORM,
        cvv: '',
        discountCode: 'FRIENDSHIP12',
      });
      const page = await response.text();

      expect(response.status).toBe(400);
      expect(page).toContain('Total: £158.37');
      expect(page).toContain('Enter the 3-digit CVV');
    });
  });

  describe('POST /checkout', () => {
    it('orders the current basket rather than sample or submitted items, grouping repeated products', async () => {
      basketItems = [
        { productID: 12, quantity: 3 },
        { productID: 12, quantity: 2 },
      ];
      const response = await post({
        ...VALID_FORM,
        customerID: '99',
        orderServices: 'forged',
      });
      expect(response.status).toBe(303);
      expect(orderRequests[0]?.body).toEqual({
        customerID: 3,
        orderServices: [{ productID: 12, quantity: 5 }],
      });
    });

    it('blocks empty baskets and disables place order', async () => {
      basketItems = [];
      const page = await (await get()).text();
      expect(page).toContain('Your basket is empty');
      expect(page).toMatch(/class="checkout-button" disabled/);
      expect((await post(VALID_FORM)).status).toBe(400);
      expect(orderRequests).toHaveLength(0);
    });

    it('blocks checkout when the basket API fails', async () => {
      basketStatus = 500;
      expect((await get()).status).toBe(502);
      expect((await post(VALID_FORM)).status).toBe(502);
      expect(orderRequests).toHaveLength(0);
    });

    it('creates the order with the home address and redirects to order history', async () => {
      const response = await post(VALID_FORM);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/order_history?placed=42');
      expect(orderRequests).toEqual([
        {
          authorization: 'Bearer customer-3',
          body: { customerID: 3, orderServices: selectedItems },
        },
      ]);
    });

    it('sends an alternative address when chosen', async () => {
      const response = await post({
        ...VALID_FORM,
        deliveryOption: 'other',
        address: '  14 Gift Lane ',
        postcode: 'BT9 5AB',
      });

      expect(response.status).toBe(303);
      expect(orderRequests[0]?.body).toEqual({
        customerID: 3,
        address: '14 Gift Lane',
        postcode: 'BT9 5AB',
        orderServices: selectedItems,
      });
    });

    it('never sends card details to the backend', async () => {
      await post(VALID_FORM);

      const sent = JSON.stringify(orderRequests);
      expect(sent).not.toContain('4242');
      expect(sent).not.toContain('cvv');
    });

    it('shows field errors, keeps safe values and does not create an order', async () => {
      const response = await post({
        firstName: 'John',
        surname: '',
        deliveryOption: 'other',
        address: '',
        postcode: 'BT9 5AB',
        cardNumber: '4242',
        expiryDate: '13/30',
        cvv: '12',
      });
      const page = await response.text();

      expect(response.status).toBe(400);
      expect(orderRequests).toHaveLength(0);
      expect(page).toContain('Enter your surname');
      expect(page).toContain('Enter your delivery address');
      expect(page).toContain('Enter a 16-digit card number');
      expect(page).toContain('Enter the expiry date as MM/YY');
      expect(page).toContain('Enter the 3-digit CVV');
      expect(page).toContain('value="John"');
      expect(page).toContain('value="BT9 5AB"');
      expect(page).toMatch(/id="delivery-other"[^>]*checked/);
      expect(page).not.toContain('4242');
    });

    it('requires a delivery option', async () => {
      const { deliveryOption: _omit, ...form } = VALID_FORM;
      const response = await post(form);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Choose a delivery address');
      expect(orderRequests).toHaveLength(0);
    });

    it('rejects an expired card', async () => {
      const response = await post({ ...VALID_FORM, expiryDate: '01/20' });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('This card has expired');
    });

    it('shows the backend error when an item is out of stock', async () => {
      const response = await post(VALID_FORM, 5);

      expect(response.status).toBe(409);
      expect(await response.text()).toContain('Not enough stock for product 4');
    });

    it('redirects to login when the backend rejects the session', async () => {
      const response = await post(VALID_FORM, 7);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        '/login?returnTo=%2Fcheckout',
      );
    });

    it('rejects cross-site submissions', async () => {
      const response = await fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: {
          cookie: cookie(3),
          'content-type': 'application/x-www-form-urlencoded',
          origin: 'https://evil.example',
        },
        body: new URLSearchParams(VALID_FORM).toString(),
      });

      expect(response.status).toBe(403);
      expect(orderRequests).toHaveLength(0);
    });
  });
});
