import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';

const CUSTOMER = 'access_token=customer-access';

const product = {
  productID: 1,
  productName: 'Furby',
  productDescription: 'A talking toy',
  productCategory: 'Toys',
  productPrice: 20,
  productImage: 'furby.webp',
  productStock: 5,
};

const backendOrder = {
  orderID: 7,
  customerID: 3,
  dateCreated: '2026-11-04T12:00:00.000Z',
  status: 'pending',
  orderServices: [
    { orderID: 7, productID: 1, quantity: 2, product },
    {
      orderID: 7,
      productID: 2,
      quantity: 1,
      product: {
        ...product,
        productID: 2,
        productName: 'Catan',
        productPrice: 35.5,
      },
    },
  ],
};

function createFakeBackend() {
  const backend = express();
  backend.get('/me', (req, res) => {
    if (req.get('authorization') !== 'Bearer customer-access') {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    res.json({ customerId: 3, role: 'customer' });
  });
  backend.get('/orders/:id', (req, res) => {
    switch (req.params.id) {
      case '7':
        res.json({ order: backendOrder });
        return;
      case '8':
        res.status(403).json({ error: 'You can only access your own orders' });
        return;
      case '9':
        res.status(500).json({ error: 'Internal server error' });
        return;
      case '10':
        res.status(401).json({ error: 'Invalid or expired access token' });
        return;
      default:
        res.status(404).json({ error: 'Order not found' });
    }
  });
  return backend;
}

async function listen(app: express.Express): Promise<[Server, string]> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return [server, `http://127.0.0.1:${port}`];
}

describe('order confirmation page', () => {
  let backendServer: Server;
  let frontendServer: Server;
  let baseUrl: string;
  const originalBackendUrl = process.env.BACKEND_URL;

  const get = (path: string, cookie = CUSTOMER) =>
    fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: 'manual' });

  beforeAll(async () => {
    let backendUrl: string;
    [backendServer, backendUrl] = await listen(createFakeBackend());
    process.env.BACKEND_URL = backendUrl;
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

  it('shows the order lines, total and date', async () => {
    const response = await get('/orders/7');
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('id="order-confirmation-title"');
    expect(page).toContain('Order #7');
    expect(page).toContain('4 Nov 2026');
    expect(page).toContain('Status: pending');
    expect(page).toContain('Furby × 2');
    expect(page).toContain('£40.00');
    expect(page).toContain('Catan × 1');
    expect(page).toContain('£35.50');
    expect(page).toContain('Total: £75.50');
    expect(page).toContain('href="/order_history"');
  });

  it('shows not found for an unknown order', async () => {
    const response = await get('/orders/404');

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Order not found.');
  });

  it("does not reveal that another customer's order exists", async () => {
    const response = await get('/orders/8');
    const page = await response.text();

    expect(response.status).toBe(404);
    expect(page).toContain('Order not found.');
    expect(page).not.toContain('your own orders');
  });

  it('shows the backend error when the order cannot be loaded', async () => {
    const response = await get('/orders/9');

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('Internal server error');
  });

  it('sends the user to login when the backend rejects the session', async () => {
    const response = await get('/orders/10');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Forders%2F10',
    );
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'rejects the invalid order id %s',
    async (id) => {
      const response = await get(`/orders/${id}`);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Invalid order id.');
    },
  );

  it('requires login', async () => {
    const response = await get('/orders/7', '');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Forders%2F7',
    );
  });
});
