import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

const basketLine = (
  basketID: number,
  name: string,
  price: number,
  qty = 1,
) => ({
  basketID,
  customerID: 3,
  productID: basketID,
  quantity: qty,
  product: {
    productID: basketID,
    productName: name,
    productDescription: 'A toy',
    productCategory: 'Toys',
    productPrice: price,
    productImage: 'toy.jpeg',
    productStock: 5,
  },
});

const basketsByCustomer: Record<string, unknown> = {
  '3': {
    basket: [basketLine(1, 'Furby', 20, 2), basketLine(2, 'Catan', 35.5)],
  },
  '4': { basket: [] },
  '6': { basket: [{ basketID: 'oops' }] },
};

function createFakeBackend() {
  const backend = express();
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
  backend.get('/basket/:customerID', (req, res) => {
    const { customerID } = req.params;
    if (customerFor(req.get('authorization')) !== customerID) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (customerID === '7') {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    const basket = basketsByCustomer[customerID];
    if (!basket) {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
    res.json(basket);
  });
  return backend;
}

async function listen(app: express.Express): Promise<[Server, string]> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return [server, `http://127.0.0.1:${port}`];
}

describe('checkout page', () => {
  let backendServer: Server;
  let frontendServer: Server;
  let baseUrl: string;
  const originalBackendUrl = process.env.BACKEND_URL;

  const get = (customerId: number) =>
    fetch(`${baseUrl}/checkout`, {
      headers: { cookie: `access_token=customer-${customerId}` },
      redirect: 'manual',
    });

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

  it("summarises the logged-in customer's basket from the backend", async () => {
    const response = await get(3);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('id="checkout-title"');
    expect(page).toContain('Furby × 2');
    expect(page).toContain('£40.00');
    expect(page).toContain('Catan × 1');
    expect(page).toContain('£35.50');
    expect(page).toContain('Total: £75.50');
    expect(page).not.toContain('Gaming Mouse');
  });

  it('shows an empty-basket message when there is nothing to check out', async () => {
    const response = await get(4);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('id="checkout-empty"');
    expect(page).not.toContain('Total:');
  });

  it('shows an error when the backend fails', async () => {
    const response = await get(5);
    const page = await response.text();

    expect(response.status).toBe(502);
    expect(page).toContain('Unable to load your basket.');
    expect(page).not.toContain('Total:');
  });

  it('shows an error when the basket response is malformed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await get(6);

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('Unable to load your basket.');
  });

  it('redirects to login when the backend rejects the session', async () => {
    const response = await get(7);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Fcheckout',
    );
  });
});
