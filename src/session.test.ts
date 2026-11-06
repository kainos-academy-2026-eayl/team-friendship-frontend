import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';

interface BackendCall {
  path: string;
  body: Record<string, unknown>;
}

const calls: BackendCall[] = [];
let refreshStatus = 200;
let profile = { firstName: 'Ada', surname: 'Lovelace' };
let saveStatus = 200;
const validAccessTokens = new Set(
  ['access-login', 'access-refreshed', 'access-current', 'access-valid'].map(
    (token) => `Bearer ${token}`,
  ),
);

function tokenBody(suffix: string) {
  return {
    accessToken: `access-${suffix}`,
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: `refresh-${suffix}`,
    refreshExpiresAt: '2099-01-01T00:00:00.000Z',
  };
}

function createFakeBackend() {
  const backend = express();
  backend.use(express.json());
  backend.use((req, _res, next) => {
    calls.push({ path: req.path, body: req.body ?? {} });
    next();
  });
  backend.post('/login', (req, res) => {
    if (req.body.password !== 'correct') {
      res.status(401).json({ error: 'Your email or password is invalid' });
      return;
    }
    res.json({ message: 'Login successful', ...tokenBody('login') });
  });
  backend.post('/auth/refresh', async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (refreshStatus !== 200) {
      res.status(refreshStatus).json({ error: 'Session expired' });
      return;
    }
    res.json(tokenBody('refreshed'));
  });
  backend.post('/auth/logout', (_req, res) => {
    res.status(204).end();
  });
  backend.get('/me', (req, res) => {
    if (!validAccessTokens.has(req.get('authorization') ?? '')) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    res.json({ customerId: 1, ...profile });
  });
  backend.get('/basket/:customerId', (_req, res) => {
    res.json({ basket: [] });
  });
  backend.get('/customers/me', (_req, res) => {
    res.json({
      customer: {
        customerID: 1,
        customerForename: 'ada',
        customerSurname: 'lovelace',
        customerEmail: 'ada@example.com',
        customerPhone: '07123456789',
        address: '12 Example Street <script>alert(1)</script>',
        postcode: 'BT1 1AA',
        customerPassword: 'never-display-this-hash',
      },
    });
    backend.patch('/customers/me', (_req, res) => {
      res.status(saveStatus).json(
        saveStatus === 200
          ? { message: 'Your details have been saved.' }
          : {
              error:
                'Your current password is incorrect. No changes were saved.',
            },
      );
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

function cookiesFrom(response: Response): Record<string, string> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((header) => {
      const [pair = ''] = header.split(';');
      const index = pair.indexOf('=');
      return [pair.slice(0, index), header];
    }),
  );
}

function postForm(url: string, fields: Record<string, string>, cookie = '') {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie && { cookie }),
    },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  });
}

describe('session authentication', () => {
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
    calls.length = 0;
    refreshStatus = 200;
    saveStatus = 200;
    profile = { firstName: 'Ada', surname: 'Lovelace' };
  });

  it('shows the signed-in first name and surname in the shared header', async () => {
    profile = { firstName: 'ada', surname: 'lovelace' };
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: 'access_token=access-valid' },
    });
    expect(await response.text()).toContain('<strong>Ada Lovelace</strong>');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('does not show an identity when logged out', async () => {
    const response = await fetch(`${baseUrl}/home`);
    expect(await response.text()).not.toContain('class="signed-in-user"');
  });

  it('escapes names returned by the backend', async () => {
    profile = { firstName: '<script>alert(1)</script>', surname: 'Test' };
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: 'access_token=access-valid' },
    });
    const html = await response.text();
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('shows the signed-in name after refreshing a session', async () => {
    const response = await fetch(`${baseUrl}/home`, {
      headers: { cookie: 'refresh_token=refresh-header-test' },
    });
    expect(await response.text()).toContain('<strong>Ada Lovelace</strong>');
  });

  it('loads customer details using the session and safely renders every public field', async () => {
    const response = await fetch(`${baseUrl}/my_details?customerID=999`, {
      headers: { cookie: 'access_token=access-valid' },
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    for (const value of [
      'Ada',
      'Lovelace',
      'ada@example.com',
      '07123456789',
      'BT1 1AA',
    ]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('never-display-this-hash');
    expect(html).not.toContain('<dt>Customer ID</dt>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(calls.map((call) => call.path)).toEqual(['/me', '/customers/me']);
  });

  it('requires login for customer details', async () => {
    const response = await fetch(`${baseUrl}/my_details`, {
      redirect: 'manual',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      '/login?returnTo=%2Fmy_details',
    );
    expect(calls).toEqual([]);
  });

  it('links the signed-in customer profile to My details', async () => {
    const html = await (
      await fetch(`${baseUrl}/home`, {
        headers: { cookie: 'access_token=access-valid' },
      })
    ).text();
    expect(html.match(/href="\/my_details"/g)).toHaveLength(2);
  });

  const editedDetails = {
    customerForename: 'ada',
    customerSurname: 'lovelace',
    customerEmail: 'ada@example.com',
    customerPhone: '07123456789',
    address: '12 New Street',
    postcode: 'BT1 1AA',
    password: 'correct-password',
  };

  it('loads the edit form with a hidden password and no stored hash', async () => {
    const response = await fetch(`${baseUrl}/my_details/edit`, {
      headers: { cookie: 'access_token=access-valid' },
    });
    const html = await response.text();
    expect(html).toContain('value="ada"');
    expect(html).toContain('type="password"');
    expect(html).toContain('Show current password');
    expect(html).not.toContain('never-display-this-hash');
  });

  it('saves editable values without changing case or accepting a supplied ID', async () => {
    const response = await postForm(
      `${baseUrl}/my_details/edit`,
      { ...editedDetails, customerID: '99' },
      'access_token=access-valid',
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/my_details?saved=1');
    expect(calls.at(-1)).toEqual({
      path: '/customers/me',
      body: editedDetails,
    });
  });

  it('shows save failures, preserves edits, and clears the password', async () => {
    saveStatus = 403;
    const response = await postForm(
      `${baseUrl}/my_details/edit`,
      editedDetails,
      'access_token=access-valid',
    );
    const html = await response.text();
    expect(response.status).toBe(403);
    expect(html).toContain('Your current password is incorrect');
    expect(html).toContain('12 New Street');
    expect(html).not.toContain('correct-password');
    expect(html).toContain('type="password"');
  });

  it('shows and hides the password without sending an update', async () => {
    for (const [visiblePasswords, expectedType] of [
      ['', 'text'],
      ['password', 'password'],
    ] as const) {
      calls.length = 0;
      const response = await postForm(
        `${baseUrl}/my_details/toggle-password`,
        { ...editedDetails, togglePassword: 'password', visiblePasswords },
        'access_token=access-valid',
      );
      const html = await response.text();
      expect(html).toContain(`name="password" type="${expectedType}"`);
      expect(html).toContain('value="correct-password"');
      expect(html).toContain('12 New Street');
      expect(calls.map((call) => call.path)).toEqual(['/me']);
    }
  });

  it('rejects cross-origin saves before contacting the backend', async () => {
    const response = await fetch(`${baseUrl}/my_details/edit`, {
      method: 'POST',
      headers: {
        origin: 'https://other.example',
        cookie: 'access_token=access-valid',
      },
    });
    expect(response.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('sets HttpOnly session cookies and redirects to returnTo on login', async () => {
    const response = await postForm(`${baseUrl}/login`, {
      email: 'ada@example.com',
      password: 'correct',
      returnTo: '/basket',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/basket');
    const cookies = cookiesFrom(response);
    expect(cookies.access_token).toMatch(/^access_token=access-login;/);
    expect(cookies.access_token).toMatch(/HttpOnly/);
    expect(cookies.access_token).toMatch(/SameSite=Lax/);
    expect(cookies.refresh_token).toMatch(/^refresh_token=refresh-login;/);
    expect(cookies.refresh_token).toMatch(/HttpOnly/);
    expect(calls).toEqual([
      {
        path: '/login',
        body: { email: 'ada@example.com', password: 'correct' },
      },
    ]);
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com'])(
    'ignores unsafe returnTo %s',
    async (returnTo) => {
      const response = await postForm(`${baseUrl}/login`, {
        email: 'ada@example.com',
        password: 'correct',
        returnTo,
      });

      expect(response.headers.get('location')).toBe('/product_browse');
    },
  );

  it.each([
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' },
    { origin: 'https://evil.com' },
    { origin: 'null' },
  ])('rejects a cross-site login POST with %o', async (headers) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body: new URLSearchParams({
        email: 'attacker@example.com',
        password: 'correct',
      }),
      redirect: 'manual',
    });

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('accepts a same-origin login POST', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'sec-fetch-site': 'same-origin',
        origin: baseUrl,
      },
      body: new URLSearchParams({
        email: 'ada@example.com',
        password: 'correct',
      }),
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(cookiesFrom(response).access_token).toMatch(
      /^access_token=access-login;/,
    );
  });

  it('re-renders the form without cookies when login fails', async () => {
    const response = await postForm(`${baseUrl}/login`, {
      email: 'ada@example.com',
      password: 'wrong',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      'Your email or password is invalid',
    );
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('keeps returnTo in the login form', async () => {
    const response = await fetch(`${baseUrl}/login?returnTo=%2Fcheckout`);

    expect(await response.text()).toContain(
      '<input type="hidden" name="returnTo" value="/checkout">',
    );
  });

  it('keeps returnTo when toggling password visibility', async () => {
    const response = await postForm(`${baseUrl}/login/toggle-password`, {
      email: 'ada@example.com',
      password: 'correct',
      togglePassword: 'password',
      returnTo: '/checkout',
    });

    expect(await response.text()).toContain(
      '<input type="hidden" name="returnTo" value="/checkout">',
    );
    expect(calls).toEqual([]);
  });

  it('refreshes an expired access token using the refresh cookie', async () => {
    const response = await fetch(`${baseUrl}/basket`, {
      headers: { cookie: 'refresh_token=refresh-expired-1' },
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    const cookies = cookiesFrom(response);
    expect(cookies.access_token).toMatch(/^access_token=access-refreshed;/);
    expect(cookies.refresh_token).toMatch(/^refresh_token=refresh-refreshed;/);
    expect(calls).toEqual([
      { path: '/auth/refresh', body: { refreshToken: 'refresh-expired-1' } },
      { path: '/me', body: {} },
      { path: '/basket/1', body: {} },
    ]);
  });

  it('refreshes only once for concurrent requests with the same token', async () => {
    const cookie = 'refresh_token=refresh-concurrent';
    const responses = await Promise.all(
      ['/basket', '/checkout', '/order_history'].map((path) =>
        fetch(`${baseUrl}${path}`, { headers: { cookie }, redirect: 'manual' }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(
      1,
    );
  });

  it('clears cookies and redirects to login when refresh is rejected', async () => {
    refreshStatus = 401;

    const response = await fetch(`${baseUrl}/basket`, {
      headers: { cookie: 'refresh_token=refresh-revoked' },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?returnTo=%2Fbasket');
    const cookies = cookiesFrom(response);
    expect(cookies.access_token).toMatch(/^access_token=;/);
    expect(cookies.refresh_token).toMatch(/^refresh_token=;/);
  });

  it('keeps cookies when the backend is unavailable during refresh', async () => {
    refreshStatus = 503;

    const response = await fetch(`${baseUrl}/basket`, {
      headers: { cookie: 'refresh_token=refresh-backend-down' },
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('revokes the session and clears cookies on logout', async () => {
    const response = await postForm(
      `${baseUrl}/logout`,
      {},
      'access_token=access-current; refresh_token=refresh-current',
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login');
    const cookies = cookiesFrom(response);
    expect(cookies.access_token).toMatch(/^access_token=;/);
    expect(cookies.refresh_token).toMatch(/^refresh_token=;/);
    expect(calls).toEqual([
      { path: '/auth/logout', body: { refreshToken: 'refresh-current' } },
    ]);
  });

  it('revokes the existing refresh token without rotating it when the access cookie has expired', async () => {
    const response = await postForm(
      `${baseUrl}/logout`,
      {},
      'refresh_token=refresh-expired-access',
    );

    expect(response.status).toBe(302);
    const cookies = cookiesFrom(response);
    expect(cookies.access_token).toMatch(/^access_token=;/);
    expect(cookies.refresh_token).toMatch(/^refresh_token=;/);
    expect(calls).toEqual([
      {
        path: '/auth/logout',
        body: { refreshToken: 'refresh-expired-access' },
      },
    ]);
  });

  it.each(['/basket', '/checkout', '/order_history'])(
    'rejects a forged access token on %s',
    async (path) => {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: 'access_token=anything' },
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        `/login?returnTo=${encodeURIComponent(path)}`,
      );
      expect(cookiesFrom(response).access_token).toMatch(/^access_token=;/);
    },
  );

  it('allows a backend-verified access token', async () => {
    const response = await fetch(`${baseUrl}/basket`, {
      headers: { cookie: 'access_token=access-valid' },
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    expect(calls.map((call) => call.path)).toEqual(['/me', '/basket/1']);
  });

  it('refreshes when the access token is rejected', async () => {
    const response = await fetch(`${baseUrl}/basket`, {
      headers: {
        cookie: 'access_token=access-expired; refresh_token=refresh-stale',
      },
      redirect: 'manual',
    });

    expect(response.status).toBe(200);
    expect(cookiesFrom(response).access_token).toMatch(
      /^access_token=access-refreshed;/,
    );
    expect(calls.map((call) => call.path)).toEqual([
      '/me',
      '/auth/refresh',
      '/me',
      '/basket/1',
    ]);
  });
});
