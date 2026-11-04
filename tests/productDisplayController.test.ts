import { get, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import productDisplayController from '../src/controllers/productDisplayController';

const backendProduct = {
  productID: 1,
  productName: 'Blue Mug',
  productDescription: 'A ceramic mug',
  productPrice: 7.5,
  productImage: '/images/mug.png',
  productStock: 3,
};

describe('productDisplayController', () => {
  let server: Server;
  const render = vi.fn();

  beforeEach(async () => {
    render.mockReset();
    const app = express();
    app.use((_req, res, next) => {
      res.render = render.mockImplementation(() => res.end());
      next();
    });
    app.use('/products', productDisplayController);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function requestProduct(id = '1'): Promise<number | undefined> {
    const { port } = server.address() as AddressInfo;
    return new Promise((resolve, reject) => {
      get(`http://127.0.0.1:${port}/products/${id}`, (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      }).on('error', reject);
    });
  }

  it.each([
    [404, 404],
    [400, 502],
    [500, 502],
    [503, 502],
  ])('maps backend status %i to %i', async (backendStatus, expectedStatus) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: backendStatus })),
    );

    expect(await requestProduct()).toBe(expectedStatus);
  });

  it.each(['not JSON', JSON.stringify({ product: {} })])(
    'returns 502 for an invalid response body: %s',
    async (body) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

      expect(await requestProduct()).toBe(502);
    },
  );

  it('returns 502 when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    expect(await requestProduct()).toBe(502);
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

    expect(await requestProduct()).toBe(200);
    expect(render).toHaveBeenCalledWith(
      'product_display/product_display',
      expect.objectContaining({
        product: expect.objectContaining({ id: 1, name: 'Blue Mug' }),
      }),
    );
  });

  it('still rejects invalid product IDs without calling the backend', async () => {
    vi.stubGlobal('fetch', vi.fn());

    expect(await requestProduct('invalid')).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
