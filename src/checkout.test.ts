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
const basketUpdates: unknown[] = [];
const stockLevels = new Map<number, number>();
let savedOrder: unknown;
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
    res.json({
      product: {
        ...product,
        productStock:
          stockLevels.get(product.productID) ?? product.productStock,
      },
    });
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
        product: (() => {
          const product = checkoutProducts.find(
            (product) => product.productID === item.productID,
          );
          return (
            product && {
              ...product,
              productStock:
                stockLevels.get(item.productID) ?? product.productStock,
            }
          );
        })(),
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
    backend.put('/basket/:id', (req, res) => {
      basketUpdates.push({
        id: req.params.id,
        body: req.body,
        authorization: req.get('authorization'),
      });
      const item = basketItems[Number(req.params.id) - 1];
      if (!item) {
        res.status(404).json({ error: 'Basket item not found.' });
        return;
      }
      const stock =
        stockLevels.get(item.productID) ??
        checkoutProducts.find((product) => product.productID === item.productID)
          ?.productStock ??
        0;
      const total = basketItems
        .filter((row) => row.productID === item.productID)
        .reduce((sum, row) => sum + row.quantity, 0);
      if (req.body.change > 0 && total + req.body.change > stock) {
        res.status(409).json({ error: 'Stock limit reached.' });
        return;
      }
      item.quantity += req.body.change;
      res.json(item);
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
    savedOrder = {
      orderID: 42,
      customerID: Number(customerId),
      dateCreated: '2026-11-05T22:00:00.000Z',
      status: 'pending',
      address: req.body.address ?? '123 Town Street',
      postcode: req.body.postcode ?? 'BT16 AAA',
      discountCode: req.body.discountCode ?? null,
      discountAmount: req.body.discountCode ? 21.6 : 0,
      orderServices: req.body.orderServices.map(
        (item: { productID: number; quantity: number }) => ({
          ...item,
          orderID: 42,
          product: checkoutProducts.find(
            (product) => product.productID === item.productID,
          ),
        }),
      ),
    };
    res.status(201).json({ order: savedOrder });
  });
  backend.get('/orders/:id', (_req, res) => {
    res.json({ order: savedOrder });
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
    savedOrder = undefined;
    discountLookups.length = 0;
    basketAdds.length = 0;
    basketUpdates.length = 0;
    stockLevels.clear();
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
      expect(html).toContain('Could not add product');
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

  describe('stock controls', () => {
    const basketPage = async () =>
      (
        await fetch(`${baseUrl}/basket`, {
          headers: { cookie: cookie(3) },
        })
      ).text();
    const productPage = async () =>
      (
        await fetch(`${baseUrl}/products/12`, {
          headers: { cookie: cookie(3) },
        })
      ).text();
    const change = (direction: string) =>
      fetch(`${baseUrl}/basket/2/quantity`, {
        method: 'POST',
        headers: {
          cookie: cookie(3),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ direction }),
        redirect: 'manual',
      });

    it('increments to the stock limit then disables the increase arrow', async () => {
      stockLevels.set(12, 3);
      expect(await basketPage()).toMatch(
        /aria-label="Increase quantity of Catan">/,
      );
      const response = await change('increase');
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/basket');
      expect(basketUpdates).toEqual([
        { id: '2', body: { change: 1 }, authorization: 'Bearer customer-3' },
      ]);
      const html = await basketPage();
      expect(html).toContain('Quantity: 3');
      expect(html).toMatch(/aria-label="Increase quantity of Catan" disabled/);
      expect(html).toContain('Stock limit reached (3 available)');
    });

    it('counts duplicate rows and disables every increase control for the product at the limit', async () => {
      basketItems.push({ productID: 12, quantity: 13 });
      const html = await basketPage();
      expect(
        html.match(/aria-label="Increase quantity of Catan" disabled/g),
      ).toHaveLength(2);
      const details = await productPage();
      expect(details).toMatch(/id="add-to-basket" disabled/);
      expect(details).toContain('You already have all available units');
    });

    it('uses only remaining stock as the product input limit', async () => {
      const html = await productPage();
      expect(html).toContain('max="13"');
      const response = await fetch(`${baseUrl}/products/12/add-to-basket`, {
        method: 'POST',
        headers: {
          cookie: cookie(3),
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ quantity: '14' }),
        redirect: 'manual',
      });
      expect(response.status).toBe(409);
      expect(basketAdds).toHaveLength(0);
    });

    it('disables additions when the database stock is zero', async () => {
      stockLevels.set(12, 0);
      const html = await productPage();
      expect(html).toContain('Out of Stock');
      expect(html).toMatch(/id="add-to-basket" disabled/);
      expect(await basketPage()).toMatch(
        /aria-label="Increase quantity of Catan" disabled/,
      );
    });

    it('allows decreasing after a stock reduction and re-enables additions below the limit', async () => {
      stockLevels.set(12, 0);
      expect((await change('decrease')).status).toBe(303);
      expect(basketItems[1]?.quantity).toBe(1);
      stockLevels.set(12, 2);
      expect(await basketPage()).toMatch(
        /aria-label="Increase quantity of Catan">/,
      );
    });

    it('handles a stale increase request without reporting success', async () => {
      stockLevels.set(12, 2);
      const response = await change('increase');
      expect(response.status).toBe(409);
      expect(response.headers.get('location')).toBeNull();
      const html = await response.text();
      expect(html).toContain('Stock limit reached.');
      expect(html).toMatch(/aria-label="Increase quantity of Catan" disabled/);
      expect(basketItems[1]?.quantity).toBe(2);
    });

    it('does not enable product additions when the basket cannot be checked', async () => {
      basketStatus = 500;
      const html = await productPage();
      expect(html).toContain('Unable to check your basket');
      expect(html).toMatch(/id="add-to-basket" disabled/);
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

    it('creates the order with the home address and redirects to its confirmation', async () => {
      const response = await post(VALID_FORM);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/order_confirmation/42');
      expect(orderRequests).toEqual([
        {
          authorization: 'Bearer customer-3',
          body: { customerID: 3, orderServices: selectedItems },
        },
      ]);
      const confirmation = await fetch(
        `${baseUrl}${response.headers.get('location')}`,
        {
          headers: { cookie: cookie(3) },
        },
      );
      expect(confirmation.status).toBe(200);
      const html = await confirmation.text();
      expect(html).toContain('42');
      expect(html).toContain('Furby');
      expect(html).toContain('Catan');
      expect(html).toContain('pending');
      expect(orderRequests).toHaveLength(1);
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
