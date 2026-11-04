import { once } from 'node:events';
import type { Server } from 'node:http';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApp } from '../src/app';

const request = globalThis.fetch;
const backendProduct = {
  productID: 1,
  productName: 'Blue Mug',
  productDescription: 'A ceramic mug',
  productPrice: 7.5,
  productImage: '/images/mug.png',
  productStock: 3,
};

describe('product display error handling', () => {
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

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each([
    [404, 404],
    [400, 502],
    [401, 502],
    [500, 502],
    [503, 502],
  ])('maps backend status %i to %i', async (backendStatus, expectedStatus) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: backendStatus })),
    );

    const response = await request(`${baseUrl}/products/1`);

    expect(response.status).toBe(expectedStatus);
    await response.text();
  });

  it.each(['not json', JSON.stringify({ product: {} })])(
    'returns 502 for an invalid backend body: %s',
    async (body) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

      const response = await request(`${baseUrl}/products/1`);

      expect(response.status).toBe(502);
      await response.text();
    },
  );

  it('returns 502 when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const response = await request(`${baseUrl}/products/1`);

    expect(response.status).toBe(502);
    await response.text();
  });

  it('still renders a valid product successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ product: backendProduct })),
        ),
    );

    const response = await request(`${baseUrl}/products/1`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Blue Mug');
  });

  it('still rejects invalid product IDs without calling the backend', async () => {
    const backendFetch = vi.fn();
    vi.stubGlobal('fetch', backendFetch);

    const response = await request(`${baseUrl}/products/invalid`);

    expect(response.status).toBe(400);
    expect(backendFetch).not.toHaveBeenCalled();
    await response.text();
  });
});
