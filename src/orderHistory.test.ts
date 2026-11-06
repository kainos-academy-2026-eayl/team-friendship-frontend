import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';

const LOGGED_IN = 'access_token=access-valid';
const SESSION_CUSTOMER_ID = 7;

interface HistoryCall {
  customerId: string | undefined;
  authorization: string | undefined;
}

const historyCalls: HistoryCall[] = [];

function createFakeBackend() {
  const backend = express();
  backend.use(express.json());
  backend.post('/login', (_req, res) => {
    res.json({
      message: 'Login successful',
      customer: { customerID: SESSION_CUSTOMER_ID },
      accessToken: 'access-login',
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: 'refresh-login',
      refreshExpiresAt: '2099-01-01T00:00:00.000Z',
    });
  });
  backend.get('/me', (req, res) => {
    if (req.get('authorization') !== 'Bearer access-valid') {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    res.json({ customerId: SESSION_CUSTOMER_ID });
  });
  backend.get('/orders/:id', (req, res) => {
    expect(req.get('authorization')).toBe('Bearer access-valid');
    if (req.params.id === '404') {
      res.sendStatus(404);
      return;
    }
    if (req.params.id === '500') {
      res.sendStatus(500);
      return;
    }
    res.json({
      order: {
        orderID: Number(req.params.id),
        customerID: req.params.id === '99' ? 99 : SESSION_CUSTOMER_ID,
        dateCreated: '2026-11-05T12:00:00.000Z',
        status: 'pending',
        orderServices: [
          {
            quantity: 2,
            product: { productName: 'Marbles <script>alert(1)</script>' },
          },
        ],
      },
    });
  });
  backend.get('/order-history/:customerID', (req, res) => {
    historyCalls.push({
      customerId: req.params.customerID,
      authorization: req.get('authorization'),
    });
    res.json({
      orders: [
        {
          orderId: 1,
          date: '01 Nov 2026',
          product: 'Bag of Marbles',
          quantity: 2,
          status: 'Delivered',
        },
        {
          orderId: 1,
          date: '01 Nov 2026',
          product: 'Pool Set',
          quantity: 1,
          status: 'Delivered',
        },
        {
          orderId: 2,
          date: '03 Nov 2026',
          product: 'Furby',
          quantity: 1,
          status: 'Pending',
        },
      ],
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

describe('order history page', () => {
  let backendServer: Server;
  let frontendServer: Server;
  let baseUrl: string;
  const originalBackendUrl = process.env.BACKEND_URL;

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

  beforeEach(() => {
    historyCalls.length = 0;
  });

  it('renders a saved order confirmation with escaped items and pending status', async () => {
    const response = await fetch(`${baseUrl}/order_confirmation/1`, {
      headers: { cookie: LOGGED_IN },
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain('Order #1');
    expect(html).toContain('Quantity: 2');
    expect(html).toContain('pending');
    expect(html).toContain('does not confirm successful payment');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('href="/order_history"');
    expect(html).toContain('href="/product_browse"');
  });

  it('requires login to view confirmation', async () => {
    const response = await fetch(`${baseUrl}/order_confirmation/1`, {
      redirect: 'manual',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Forder_confirmation%2F1',
    );
  });

  it.each(['0', '-1', 'abc', '1.5'])(
    'rejects invalid confirmation reference %s',
    async (id) => {
      const response = await fetch(`${baseUrl}/order_confirmation/${id}`, {
        headers: { cookie: LOGGED_IN },
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Invalid order reference.');
    },
  );

  it.each([
    ['99', 404],
    ['404', 404],
    ['500', 502],
  ] as const)(
    'does not show confirmation for unavailable order %s',
    async (id, status) => {
      const response = await fetch(`${baseUrl}/order_confirmation/${id}`, {
        headers: { cookie: LOGGED_IN },
      });
      expect(response.status).toBe(status);
      const html = await response.text();
      expect(html).toContain('role="alert"');
      expect(html).not.toContain('id="confirmation-reference"');
    },
  );

  it('requests the history of the session customer with the access token', async () => {
    const response = await fetch(`${baseUrl}/order_history`, {
      headers: { cookie: LOGGED_IN },
    });
    await response.text();

    expect(response.status).toBe(200);
    expect(historyCalls).toEqual([
      {
        customerId: String(SESSION_CUSTOMER_ID),
        authorization: 'Bearer access-valid',
      },
    ]);
  });

  it('ignores a forged customerID cookie', async () => {
    const response = await fetch(`${baseUrl}/order_history`, {
      headers: { cookie: `${LOGGED_IN}; customerID=999` },
    });
    await response.text();

    expect(historyCalls.map((call) => call.customerId)).toEqual([
      String(SESSION_CUSTOMER_ID),
    ]);
  });

  it('groups product lines under one card per order', async () => {
    const response = await fetch(`${baseUrl}/order_history`, {
      headers: { cookie: LOGGED_IN },
    });
    const body = await response.text();

    expect(body.match(/class="order-card"/g)).toHaveLength(2);
    expect(body.match(/Order #1/g)).toHaveLength(1);
    expect(body).toContain('Bag of Marbles (Quantity: 2)');
    expect(body).toContain('Pool Set (Quantity: 1)');
    expect(body).toContain('Furby (Quantity: 1)');
  });

  it('redirects to login without a session', async () => {
    const response = await fetch(`${baseUrl}/order_history`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Forder_history',
    );
    expect(historyCalls).toEqual([]);
  });

  it('does not set a customerID cookie on login', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'eva@example.com', password: 'x' }),
      redirect: 'manual',
    });
    await response.text();

    const names = response.headers
      .getSetCookie()
      .map((header) => header.split('=')[0]);
    expect(names).toContain('access_token');
    expect(names).not.toContain('customerID');
  });
});
