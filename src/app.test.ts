import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('HTTP application', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
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

  it('serves the basket page', async () => {
    const response = await fetch(`${baseUrl}/basket`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="basket-title"');
  });

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

  it('serves the checkout page', async () => {
    const response = await fetch(`${baseUrl}/checkout`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="checkout-title"');
  });

  it('serves the order history page', async () => {
    const response = await fetch(`${baseUrl}/order_history`);

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
    const response = await fetch(`${baseUrl}${path}`);
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
      '/login',
    ]);
    expect(nav).toMatch(
      /<ul class="sidebar-links sidebar-links-bottom">\s*<li>\s*<a href="\/login"/,
    );

    if (navHrefs.includes(path)) {
      expect(nav).toContain(
        `<a href="${path}" class="active" aria-current="page">`,
      );
    } else {
      expect(nav).not.toContain('class="active"');
    }
  });
});
