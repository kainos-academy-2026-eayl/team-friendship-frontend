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
import { createApp } from './app';

const products = [
  { productID: 1, productName: 'Empty shelf', productStock: 0 },
  { productID: 2, productName: '<script>alert(1)</script>', productStock: 1 },
  { productID: 3, productName: 'Last few', productStock: 4 },
  { productID: 4, productName: 'Enough stock', productStock: 5 },
];

const sessionTokens = {
  accessToken: 'admin-access',
  refreshToken: 'admin-refresh',
  expiresIn: 900,
  refreshExpiresAt: '2099-01-01T00:00:00.000Z',
};

async function listen(app: express.Express): Promise<[Server, string]> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return [server, `http://127.0.0.1:${port}`];
}

describe('admin portal', () => {
  let frontend: Server;
  let backend: Server;
  let baseUrl: string;
  let dashboardStatus = 200;
  let reorderStatus = 200;
  let dashboardOverride: unknown;
  let stock = products.map((product) => ({ ...product }));
  const dashboardRequests: string[] = [];
  const reorders: {
    id: string;
    body: unknown;
    authorization: string | undefined;
  }[] = [];
  const originalBackendUrl = process.env.BACKEND_URL;

  beforeAll(async () => {
    const api = express();
    api.use(express.json());
    api.post('/login', (req, res) => {
      if (req.body.password !== 'test-password') {
        res.status(401).json({ error: 'Your email or password is invalid' });
        return;
      }
      const admin = req.body.email === 'admin@friendshop.com';
      res.json({
        ...sessionTokens,
        accessToken: admin ? 'admin-access' : 'customer-access',
        customer: { role: admin ? 'admin' : 'customer' },
      });
    });
    api.post('/auth/refresh', (_req, res) => res.json(sessionTokens));
    api.get('/me', (req, res) => {
      const authorization = req.get('authorization');
      if (authorization === 'Bearer admin-access') {
        res.json({ customerId: 1, role: 'admin' });
      } else if (authorization === 'Bearer customer-access') {
        res.json({ customerId: 2, role: 'customer' });
      } else {
        res.status(401).json({ error: 'Invalid token' });
      }
    });
    api.get('/admin/dashboard', (req, res) => {
      dashboardRequests.push(String(req.query.period));
      if (req.get('authorization') !== 'Bearer admin-access') {
        res.sendStatus(403);
        return;
      }
      res.status(dashboardStatus).json(
        dashboardOverride ?? {
          period: req.query.period,
          totalOrders: 12,
          revenue: 1234.5,
          currency: 'GBP',
          lowStockProducts: stock.filter((product) => product.productStock < 5),
        },
      );
    });
    api.post('/admin/products/:id/reorder', (req, res) => {
      reorders.push({
        id: req.params.id,
        body: req.body,
        authorization: req.get('authorization'),
      });
      if (reorderStatus !== 200) {
        res.sendStatus(reorderStatus);
        return;
      }
      const product = stock.find(
        (item) => item.productID === Number(req.params.id),
      );
      if (!product) {
        res.sendStatus(404);
        return;
      }
      product.productStock += 20;
      res.json({ product });
    });
    let apiUrl: string;
    [backend, apiUrl] = await listen(api);
    process.env.BACKEND_URL = apiUrl;
    [frontend, baseUrl] = await listen(createApp());
  });

  beforeEach(() => {
    dashboardStatus = 200;
    reorderStatus = 200;
    dashboardOverride = undefined;
    dashboardRequests.length = 0;
    reorders.length = 0;
    stock = products.map((product) => ({ ...product }));
  });

  afterAll(async () => {
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalBackendUrl;
    }
    for (const server of [frontend, backend]) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  function get(path = '/admin', cookie = 'access_token=admin-access') {
    return fetch(`${baseUrl}${path}`, {
      headers: { cookie },
      redirect: 'manual',
    });
  }

  function post(path: string, fields: Record<string, string>, cookie = '') {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams(fields),
      redirect: 'manual',
    });
  }

  it('redirects an authenticated admin from the existing login form', async () => {
    const response = await post('/login', {
      email: 'admin@friendshop.com',
      password: 'test-password',
      returnTo: '/basket',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/admin');
    expect(response.headers.getSetCookie().join(';')).toContain('HttpOnly');
  });

  it('keeps customer login behaviour unchanged', async () => {
    const response = await post('/login', {
      email: 'customer@example.com',
      password: 'test-password',
      returnTo: '/basket',
      role: 'admin',
    });
    expect(response.headers.get('location')).toBe('/basket');
  });

  it('does not bypass authentication for the admin email', async () => {
    const response = await post('/login', {
      email: 'admin@friendshop.com',
      password: 'wrong-password',
    });
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await response.text()).toContain(
      'Your email or password is invalid',
    );
  });

  it('redirects logged-out users to login without fetching dashboard data', async () => {
    const response = await get('/admin?period=week', '');
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Fadmin%3Fperiod%3Dweek',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(dashboardRequests).toEqual([]);
  });

  it('rejects customers even with a forged admin cookie', async () => {
    const response = await get(
      '/admin',
      'access_token=customer-access; role=admin; isAdmin=true',
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      'An administrator account is required',
    );
    expect(dashboardRequests).toEqual([]);
  });

  it('rejects a forged access token', async () => {
    const response = await get('/admin', 'access_token=forged');
    expect(response.status).toBe(302);
    expect(dashboardRequests).toEqual([]);
  });

  it('checks the backend role again after refreshing an admin session', async () => {
    const response = await get('/admin', 'refresh_token=admin-refresh');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Total revenue');
    expect(dashboardRequests).toEqual(['today']);
  });

  it.each(['today', 'week', 'month'])(
    'requests the selected %s period',
    async (period) => {
      const response = await get(`/admin?period=${period}`);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(dashboardRequests).toEqual([period]);
      expect(html).toContain(`value="${period}" selected`);
      expect(html).toContain('1,234.50');
      expect(html).toContain('<dd>12</dd>');
      expect(html).toContain('href="/admin"');
    },
  );

  it('defaults to today', async () => {
    expect((await get()).status).toBe(200);
    expect(dashboardRequests).toEqual(['today']);
  });

  it('separates zero stock from quantities 1 through 4 and excludes 5', async () => {
    const html = await (await get()).text();
    expect(html).toContain('admin-stock-card--empty');
    expect(html).toContain('Urgent: these products have no stock remaining.');
    expect(html).toContain('0 units remaining');
    expect(html).toContain('1 units remaining');
    expect(html).toContain('4 units remaining');
    expect(html).not.toContain('Enough stock');
    expect(html).toContain('Reorder +20');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows genuine zero totals and empty stock lists', async () => {
    dashboardOverride = {
      period: 'today',
      totalOrders: 0,
      revenue: 0,
      currency: 'GBP',
      lowStockProducts: [],
    };
    const html = await (await get()).text();
    expect(html).toContain('<dd>0</dd>');
    expect(html).toContain('0.00');
    expect(html).toContain('No products are out of stock.');
    expect(html).toContain('No low stock alerts.');
  });

  it.each(['year', '', 'week&period=month'])(
    'rejects invalid period %s',
    async (period) => {
      const response = await get(`/admin?period=${period}`);
      expect(response.status).toBe(400);
      expect(dashboardRequests).toEqual([]);
    },
  );

  it.each([401, 403, 404, 500])(
    'shows an explicit dashboard API %s error, not fake totals',
    async (status) => {
      dashboardStatus = status;
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const response = await get();
        const html = await response.text();
        expect(response.status).toBe(
          status === 401 || status === 403 ? status : 502,
        );
        expect(html).toContain('role="alert"');
        expect(html).not.toContain('class="admin-metric"');
      } finally {
        log.mockRestore();
      }
    },
  );

  it.each([
    {
      period: 'today',
      totalOrders: 1,
      revenue: -1,
      currency: 'GBP',
      lowStockProducts: [],
    },
    {
      period: 'today',
      totalOrders: 1,
      revenue: 1,
      currency: 'GBP',
      lowStockProducts: [products[3]],
    },
    {
      period: 'month',
      totalOrders: 1,
      revenue: 1,
      currency: 'GBP',
      lowStockProducts: [],
    },
    {},
  ])('rejects invalid dashboard responses %#', async (payload) => {
    dashboardOverride = payload;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await get();
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain('class="admin-metric"');
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it('posts a reorder to the backend without accepting a client-supplied quantity', async () => {
    const response = await post(
      '/admin/products/1/reorder',
      {
        period: 'month',
        quantity: '999',
      },
      'access_token=admin-access',
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/admin?period=month&reordered=1',
    );
    expect(reorders).toEqual([
      { id: '1', body: undefined, authorization: 'Bearer admin-access' },
    ]);
    expect(stock.find((product) => product.productID === 1)?.productStock).toBe(
      20,
    );

    const html = await (
      await get(response.headers.get('location') ?? '/admin')
    ).text();
    expect(html).toContain('Stock updated successfully');
    expect(html).not.toContain('Empty shelf');
    expect(dashboardRequests).toEqual(['month']);
  });

  it('blocks customers from reordering without contacting the stock API', async () => {
    const response = await post(
      '/admin/products/1/reorder',
      { period: 'today' },
      'access_token=customer-access',
    );
    expect(response.status).toBe(403);
    expect(reorders).toEqual([]);
  });

  it('blocks logged-out users from reordering', async () => {
    const response = await post('/admin/products/1/reorder', {
      period: 'today',
    });
    expect(response.status).toBe(302);
    expect(reorders).toEqual([]);
  });

  it.each(['0', '-1', '1.5', 'abc', '9007199254740992'])(
    'rejects invalid product ID %s',
    async (id) => {
      const response = await post(
        `/admin/products/${id}/reorder`,
        { period: 'today' },
        'access_token=admin-access',
      );
      expect(response.status).toBe(400);
      expect(reorders).toEqual([]);
    },
  );

  it('rejects a reorder with an invalid period', async () => {
    const response = await post(
      '/admin/products/1/reorder',
      { period: 'invalid' },
      'access_token=admin-access',
    );
    expect(response.status).toBe(400);
    expect(reorders).toEqual([]);
  });

  it('rejects cross-origin reorders', async () => {
    const response = await fetch(`${baseUrl}/admin/products/1/reorder`, {
      method: 'POST',
      headers: {
        cookie: 'access_token=admin-access',
        origin: 'https://other.example.com',
      },
      redirect: 'manual',
    });
    expect(response.status).toBe(403);
    expect(reorders).toEqual([]);
  });

  it.each([401, 403, 404, 500])(
    'does not claim success when reordering fails with %s',
    async (status) => {
      reorderStatus = status;
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const response = await post(
          '/admin/products/1/reorder',
          { period: 'week' },
          'access_token=admin-access',
        );
        const html = await response.text();
        expect(response.status).toBe(status === 500 ? 502 : status);
        expect(html).toContain('role="alert"');
        expect(html).not.toContain('Stock updated successfully');
        expect(stock[0]?.productStock).toBe(0);
      } finally {
        log.mockRestore();
      }
    },
  );
});
