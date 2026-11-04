import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, afterEach } from 'vitest';
import { createApp } from './app';

const LOGGED_IN = 'access_token=test-access-token';

function createFakeBackend() {
  const backend = express();
  backend.get('/me', (req, res) => {
    if (req.get('authorization') !== 'Bearer test-access-token') {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    res.json({ customerId: 1 });
  });
  return backend;
}
import {
  vi
} from 'vitest';

const nativeFetch = globalThis.fetch.bind(globalThis);

describe('HTTP application', () => {
  let server: Server;
  let backendServer: Server;
  let baseUrl: string;
  const originalBackendUrl = process.env.BACKEND_URL;

  beforeAll(async () => {
    backendServer = createFakeBackend().listen(0, '127.0.0.1');
    await once(backendServer, 'listening');
    const { port: backendPort } = backendServer.address() as AddressInfo;
    process.env.BACKEND_URL = `http://127.0.0.1:${backendPort}`;

    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalBackendUrl;
    }
    for (const s of [server, backendServer]) {
      if (s) {
        await new Promise<void>((resolve, reject) => {
          s.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves the login page', async () => {
    const response = await fetch(`${baseUrl}/login`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('<h1 id="login-title">E-commerce login</h1>');
    expect(body).toContain('method="post" action="/login"');
    expect(body).toContain('href="/register"');
    expect(body).not.toContain('/scripts/login.js');
    expect(body).toContain(
      '<link rel="stylesheet" href="/styles/ecommerce.css">',
    );
  });

  it('serves the registration page', async () => {
    const response = await fetch(`${baseUrl}/register`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('id="registration-form"');
    expect(body).toContain('method="post" action="/register"');
    expect(body).not.toContain('/scripts/register.js');
    expect(body).toMatch(/<a href="\/">\s*Team Friendship\s*<\/a>/);
    expect(body).toContain('src="/images/Friendshop_logo.png"');
  });

  it('rejects registration when passwords do not match', async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        password: 'password-one',
        confirmPassword: 'password-two',
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Passwords do not match.');
  });

  it('serves the forgot-password page and form', async () => {
    const pageResponse = await fetch(`${baseUrl}/forgot_password`);
    const pageBody = await pageResponse.text();

    expect(pageResponse.status).toBe(200);
    expect(pageBody).toContain('id="send-recovery-email"');
    expect(pageBody).toContain(
      '<form id="forgot-password-form" action="/forgot_password" method="post">',
    );
  });

  it('renders the reset page with a locked email and masked passwords', async () => {
    const response = await fetch(
      `${baseUrl}/reset_password?email=person%2Breset%40example.com&token=reset-token`,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('value="person+reset@example.com" readonly');
    expect(body).toContain('type="hidden" name="token" value="reset-token"');
    expect(body).toContain('method="post" action="/reset_password"');
    expect(body).toContain('name="newPassword" type="password"');
    expect(body).toContain('name="confirmPassword" type="password"');
    expect(body).toContain('data-password-toggle="new-password"');
    expect(body).toContain('data-password-toggle="confirm-password"');
    expect(body).not.toContain('aria-invalid="true"');
    expect(body).toContain('/scripts/reset-password.js');
  });

  const postResetPassword = (
    newPassword: string,
    confirmPassword: string,
    token = 'reset-token',
  ) =>
    nativeFetch(`${baseUrl}/reset_password`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'person@example.com',
        token,
        newPassword,
        confirmPassword,
      }),
    });

  it.each([
    ['short1!', 'Password must be at least 8 characters long.'],
    ['NoNumbers!', 'Password must contain at least one number.'],
    ['NoSpecial123', 'Password must contain at least one special character.'],
  ])('rejects the reset password %s', async (password, message) => {
    const response = await postResetPassword(password, password);
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain(message);
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('value="person@example.com" readonly');
    expect(body).not.toContain(`value="${password}"`);
  });

  it('rejects reset passwords that do not match', async () => {
    const response = await postResetPassword('Valid123!', 'Different123!');
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('Passwords do not match.');
    expect(body).toContain('aria-describedby="confirm-password-error"');
  });

  it('saves a valid matching reset password through the backend', async () => {
    let backendRequest: { url: string; init: RequestInit } | undefined;
    vi.stubGlobal(
      'fetch',
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === 'http://localhost:3000/reset-password') {
          backendRequest = { url, init: init ?? {} };
          return Response.json({ message: 'Password reset successfully.' });
        }
        return nativeFetch(input, init);
      },
    );

    const response = await postResetPassword('Valid123!', 'Valid123!');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain('aria-invalid="true"');
    expect(body).toContain('Password reset successfully.');
    expect(backendRequest?.url).toBe('http://localhost:3000/reset-password');
    expect(backendRequest?.init?.method).toBe('POST');
    expect(JSON.parse(String(backendRequest?.init?.body))).toEqual({
      email: 'person@example.com',
      token: 'reset-token',
      password: 'Valid123!',
    });
  });

  it('shows backend reset errors instead of reporting success', async () => {
    vi.stubGlobal(
      'fetch',
      async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input) === 'http://localhost:3000/reset-password') {
          return Response.json(
            { error: 'Invalid or expired reset link' },
            { status: 400 },
          );
        }
        return nativeFetch(input, init);
      },
    );

    const response = await postResetPassword('Valid123!', 'Valid123!');
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('Invalid or expired reset link');
    expect(body).not.toContain('Password reset successfully.');
  });

  it('escapes the reset email supplied in the link', async () => {
    const response = await fetch(
      `${baseUrl}/reset_password?${new URLSearchParams({ email: '"><script>alert(1)</script>' })}`,
    );
    expect(await response.text()).not.toContain(
      'value=""><script>alert(1)</script>',
    );
  });

  it('redirects to the forgot-password page when the email is missing', async () => {
    const response = await fetch(`${baseUrl}/forgot_password`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain(
      'error=Please%20enter%20a%20valid%20email%20address.',
    );
  });

  it('serves the basket page when logged in', async () => {
    const response = await fetch(`${baseUrl}/basket`, {
      headers: { cookie: LOGGED_IN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="basket-title"');
  });

  it.each(['/basket', '/checkout', '/order_history'])(
    'redirects %s to login when logged out',
    async (path) => {
      const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        `/login?returnTo=${encodeURIComponent(path)}`,
      );
    },
  );

  it.each(['/home', '/product_display', '/forgot_password'])(
    'serves the page at %s',
    async (path) => {
      const response = await fetch(`${baseUrl}${path}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    },
  );

  it('serves the stylesheet at the linked path', async () => {
    const response = await fetch(`${baseUrl}/styles/ecommerce.css`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/css');
    expect(await response.text()).toContain('#registration-status');
  });

  it('reports a healthy service with uptime', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
    });
  });

  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/not-found`);

    expect(response.status).toBe(404);
    await response.text();
  });

  it('serves the checkout page when logged in', async () => {
    const response = await fetch(`${baseUrl}/checkout`, {
      headers: { cookie: LOGGED_IN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="checkout-title"');
  });

  it('serves the order history page when logged in', async () => {
    const response = await fetch(`${baseUrl}/order_history`, {
      headers: { cookie: LOGGED_IN },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="order-history-title"');
  });

  it.each([
    '/home',
    '/basket',
    '/checkout',
    '/register',
    '/product_display',
    '/forgot_password',
    '/order_history',
    '/login',
  ])('renders the sidebar navigation on %s', async (path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: LOGGED_IN },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('id="sidebar-toggle"');
    expect(body).toContain(
      '<label for="sidebar-toggle" class="sidebar-toggle">',
    );

    const nav = body.match(/<nav id="sidebar-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const navHrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(
      ([, href]) => href,
    );
    expect(navHrefs).toEqual([
      '/home',
      '/product_browse',
      '/basket',
      '/order_history',
    ]);
    expect(nav).toMatch(
      /<ul class="sidebar-links sidebar-links-bottom">\s*<li>\s*<form method="post" action="\/logout">/,
    );

    if (navHrefs.includes(path)) {
      expect(nav).toContain(
        `<a href="${path}" class="active" aria-current="page">`,
      );
    } else {
      expect(nav).not.toContain('class="active"');
    }
  });

  it('shows the login link instead of logout when logged out', async () => {
    const response = await fetch(`${baseUrl}/home`);
    const nav =
      (await response.text()).match(
        /<nav id="sidebar-nav"[\s\S]*?<\/nav>/,
      )?.[0] ?? '';

    expect(nav).toMatch(
      /<ul class="sidebar-links sidebar-links-bottom">\s*<li>\s*<a href="\/login"/,
    );
    expect(nav).not.toContain('action="/logout"');
  });
});
