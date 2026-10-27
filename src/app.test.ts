import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('HTTP application', () => {
  let server: Server;
  let baseUrl: string;

  /* test server setup */
  beforeAll(async () => {
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected the test server to listen on a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  /* test server teardown */
  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  /* test login page */
  it('serves the login page', async () => {
    const response = await fetch(`${baseUrl}/login`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('<h1 id="login-title">E-commerce login</h1>');
    expect(body).toContain(
      '<link rel="stylesheet" href="/styles/ecommerce.css">',
    );
  });

  /* test registration page */
  it('serves the registration page', async () => {
    const response = await fetch(`${baseUrl}/register`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('id="registration-form"');
    expect(body).toContain('<a href="/">Team Friendship</a>');
  });

  /* test basket page */
  it('serves the basket page', async () => {
    const response = await fetch(`${baseUrl}/basket`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="basket-title"');
  });

  /* test stylesheet */
  it('serves the stylesheet at the linked path', async () => {
    const response = await fetch(`${baseUrl}/styles/ecommerce.css`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/css');
    expect(await response.text()).toContain('#registration-status');
  });

  /* test health endpoint */
  it('reports a healthy service with uptime', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
    });
  });

  /* test unknown routes */
  it('returns 404 for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/not-found`);

    expect(response.status).toBe(404);
    await response.text();
  });
});
