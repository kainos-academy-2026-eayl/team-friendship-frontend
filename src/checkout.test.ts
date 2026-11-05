import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const CUSTOMER = 'access_token=customer-access';
const STAFF = 'access_token=staff-access';

interface BasketRow {
  basketID: number;
  customerID: number;
  productID: number;
  quantity: number;
}

const product = {
  productID: 1,
  productName: 'Furby',
  productDescription: 'A talking toy',
  productCategory: null,
  productPrice: 20,
  productImage: 'furby.webp',
  productStock: 5,
};

let basket: BasketRow[] = [];
let nextBasketID = 1;
let orderStatus = 201;
let orderRequests: unknown[] = [];
let deletedBasketIDs: number[] = [];
let deleteStatus = 200;

const backendOrder = {
  orderID: 7,
  customerID: 3,
  dateCreated: '2026-11-04T12:00:00.000Z',
  status: 'pending',
  orderServices: [{ orderID: 7, productID: 1, quantity: 2, product }],
};

function createFakeBackend() {
  const backend = express();
  backend.use(express.json());
  backend.get('/me', (req, res) => {
    const auth = req.get('authorization');
    if (auth === 'Bearer customer-access') {
      res.json({ customerId: 3, role: 'customer' });
    } else if (auth === 'Bearer staff-access') {
      res.json({ staffID: 9, role: 'staff' });
    } else {
      res.status(401).json({ error: 'Invalid or expired access token' });
    }
  });
  backend.get('/products/:id', (_req, res) => {
    res.json({ product });
  });
  backend.get('/basket/:customerID', (req, res) => {
    res.json({
      basket: basket
        .filter((row) => row.customerID === Number(req.params.customerID))
        .map((row) => ({ ...row, product })),
    });
  });
  backend.post('/basket', (req, res) => {
    const row = { basketID: nextBasketID++, ...req.body };
    basket.push(row);
    res.status(201).json(row);
  });
  backend.put('/basket/:basketID', (req, res) => {
    const row = basket.find((r) => r.basketID === Number(req.params.basketID));
    if (row) row.quantity = req.body.quantity;
    res.json(row);
  });
  backend.delete('/basket/:basketID', (req, res) => {
    deletedBasketIDs.push(Number(req.params.basketID));
    if (deleteStatus !== 200) {
      res.status(deleteStatus).json({ error: 'Internal server error' });
      return;
    }
    basket = basket.filter((r) => r.basketID !== Number(req.params.basketID));
    res.json({});
  });
  backend.post('/orders', (req, res) => {
    orderRequests.push(req.body);
    if (orderStatus === 201) {
      res.status(201).json({ order: backendOrder });
      return;
    }
    res.status(orderStatus).json({ error: 'Not enough stock for product 1' });
  });
  backend.get('/orders/:id', (req, res) => {
    if (req.params.id !== '7') {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ order: backendOrder });
  });
  return backend;
}

async function listen(app: express.Express): Promise<[Server, string]> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return [server, `http://127.0.0.1:${port}`];
}

const delivery = {
  firstName: 'Ada',
  surname: 'Lovelace',
  address: '1 Analytical Way',
  postcode: 'BT1 1AA',
  email: 'ada@example.com',
};

describe('basket, checkout and order confirmation', () => {
  let backendServer: Server;
  let frontendServer: Server;
  let baseUrl: string;
  const originalBackendUrl = process.env.BACKEND_URL;

  const post = (
    path: string,
    fields: Record<string, string>,
    cookie = CUSTOMER,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(cookie && { cookie }),
      },
      body: new URLSearchParams(fields),
      redirect: 'manual',
    });

  const get = (path: string, cookie = CUSTOMER) =>
    fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: 'manual' });

  beforeAll(async () => {
    let backendUrl: string;
    [backendServer, backendUrl] = await listen(createFakeBackend());
    process.env.BACKEND_URL = backendUrl;
    // productDisplayServices reads BACKEND_URL at import time, so load the app afterwards.
    const { createApp } = await import('./app');
    [frontendServer, baseUrl] = await listen(createApp());
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

  beforeEach(() => {
    basket = [];
    nextBasketID = 1;
    orderStatus = 201;
    orderRequests = [];
    deletedBasketIDs = [];
    deleteStatus = 200;
  });

  describe('basket', () => {
    it('posts the product page form to the basket', async () => {
      const page = await (await get('/products/1')).text();

      expect(page).toContain('method="post" action="/basket/items"');
      expect(page).toContain('name="productID" value="1"');
      expect(page).toContain('name="quantity" type="number"');
      expect(page).toMatch(/<button type="submit" id="add-to-basket"/);
    });

    it('adds a product and shows it in the basket', async () => {
      const added = await post('/basket/items', {
        productID: '1',
        quantity: '2',
      });
      expect(added.status).toBe(303);
      expect(added.headers.get('location')).toBe('/basket');

      const page = await (await get('/basket')).text();
      expect(page).toContain('Furby');
      expect(page).toContain('Quantity: 2');
      expect(page).toContain('£40.00');
      expect(page).toContain('<a href="/checkout" id="checkout"');
    });

    it('tops up an existing line rather than duplicating the product', async () => {
      await post('/basket/items', { productID: '1', quantity: '1' });
      await post('/basket/items', { productID: '1', quantity: '2' });

      expect(basket).toEqual([
        { basketID: 1, customerID: 3, productID: 1, quantity: 3 },
      ]);
    });

    it('disables checkout when the basket is empty', async () => {
      const page = await (await get('/basket')).text();

      expect(page).toContain('Your basket is empty.');
      expect(page).toMatch(/<button type="button" id="checkout"[^>]*disabled/);
    });

    it('sends logged-out users to login and back to the product', async () => {
      const response = await post(
        '/basket/items',
        { productID: '1', quantity: '1' },
        '',
      );

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        '/login?returnTo=%2Fproducts%2F1',
      );
    });

    it('rejects invalid quantities', async () => {
      const response = await post('/basket/items', {
        productID: '1',
        quantity: '0',
      });

      expect(response.status).toBe(400);
      expect(basket).toEqual([]);
    });

    it('refuses staff accounts', async () => {
      const response = await post(
        '/basket/items',
        { productID: '1', quantity: '1' },
        STAFF,
      );

      expect(response.status).toBe(403);
      expect(basket).toEqual([]);
    });
  });

  describe('checkout', () => {
    beforeEach(() => {
      basket = [{ basketID: 4, customerID: 3, productID: 1, quantity: 2 }];
    });

    it('summarises the basket without any card fields', async () => {
      const page = await (await get('/checkout')).text();

      expect(page).toContain('Furby × 2');
      expect(page).toContain('Total: £40.00');
      expect(page).toContain('method="post" action="/checkout"');
      expect(page).not.toMatch(/card-number|cvv|expiry/i);
    });

    it('places the order, clears the basket and redirects to confirmation', async () => {
      const response = await post('/checkout', delivery);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/orders/7');
      expect(orderRequests).toEqual([
        { customerID: 3, orderServices: [{ productID: 1, quantity: 2 }] },
      ]);
      expect(deletedBasketIDs).toEqual([4]);
    });

    it('shows field errors and keeps the values when details are invalid', async () => {
      const response = await post('/checkout', {
        ...delivery,
        postcode: 'nope',
        email: 'not-an-email',
      });
      const page = await response.text();

      expect(response.status).toBe(400);
      expect(page).toContain('Enter a valid UK postcode.');
      expect(page).toContain('Enter a valid email address.');
      expect(page).toContain('value="Ada"');
      expect(orderRequests).toEqual([]);
    });

    it('refuses to order an empty basket', async () => {
      basket = [];

      const response = await post('/checkout', delivery);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Your basket is empty.');
      expect(orderRequests).toEqual([]);
    });

    it('shows the stock error and keeps the basket when stock runs out', async () => {
      orderStatus = 409;

      const response = await post('/checkout', delivery);

      expect(response.status).toBe(409);
      expect(await response.text()).toContain('Not enough stock for product 1');
      expect(deletedBasketIDs).toEqual([]);
    });

    it('sends the user to login when the backend rejects the session', async () => {
      orderStatus = 401;

      const response = await post('/checkout', delivery);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        '/login?returnTo=%2Fcheckout',
      );
    });

    it('still confirms the order when clearing the basket fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      deleteStatus = 500;

      const response = await post('/checkout', delivery);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('/orders/7');
      expect(errorSpy).toHaveBeenCalledWith(
        'Order 7 placed but basket was not cleared',
        'Unable to clear your basket.',
      );
      errorSpy.mockRestore();
    });

    it('refuses staff accounts', async () => {
      const response = await get('/checkout', STAFF);

      expect(response.status).toBe(403);
      expect(await response.text()).toContain(
        'Only customer accounts can place orders.',
      );
    });
  });

  describe('order confirmation', () => {
    it('shows the placed order', async () => {
      const response = await get('/orders/7');
      const page = await response.text();

      expect(response.status).toBe(200);
      expect(page).toContain('id="order-confirmation-title"');
      expect(page).toContain('Order #7');
      expect(page).toContain('Furby × 2');
      expect(page).toContain('Total: £40.00');
      expect(page).toContain('4 Nov 2026');
    });

    it('shows not found for unknown orders', async () => {
      const response = await get('/orders/8');

      expect(response.status).toBe(404);
      expect(await response.text()).toContain('Order not found.');
    });

    it('requires login', async () => {
      const response = await get('/orders/7', '');

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        '/login?returnTo=%2Forders%2F7',
      );
    });
  });
});
