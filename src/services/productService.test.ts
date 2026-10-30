import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterProducts, getProducts } from './productService';

const backendProduct = {
  productID: 1,
  productName: 'Blue Mug',
  productDescription: 'A ceramic mug',
  productPrice: 7.5,
  productImage: '/images/mug.png',
  productStock: 3,
};

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
}

describe('productService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps backend products to view models', async () => {
    mockFetch({ products: [backendProduct] });

    const result = await getProducts('http://backend');

    expect(fetch).toHaveBeenCalledWith(
      'http://backend/products',
      expect.anything(),
    );
    expect(result).toEqual({
      ok: true,
      products: [
        {
          id: 1,
          name: 'Blue Mug',
          description: 'A ceramic mug',
          price: '7.50',
          imageUrl: '/images/products_images/mug.png',
          stock: 3,
        },
      ],
    });
  });

  it('rejects responses that fail schema validation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => { });
    mockFetch({ products: [{ ...backendProduct, productPrice: 'free' }] });

    const result = await getProducts('http://backend');

    expect(result).toEqual({ ok: false, message: 'Unable to load products.' });
  });

  it('returns an error when the backend responds with a failure', async () => {
    mockFetch({ error: 'Internal server error' }, 500);

    const result = await getProducts('http://backend');

    expect(result.ok).toBe(false);
  });

  it('returns an error when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const result = await getProducts('http://backend');

    expect(result).toEqual({
      ok: false,
      message: 'Unable to reach the server. Please try again.',
    });
  });

  it('filters products by name or description', () => {
    const products = [
      {
        id: 1,
        name: 'Blue Mug',
        description: 'Ceramic',
        price: '1.00',
        imageUrl: '',
        stock: 1,
      },
      {
        id: 2,
        name: 'Red Hat',
        description: 'Woollen',
        price: '2.00',
        imageUrl: '',
        stock: 1,
      },
    ];

    expect(filterProducts(products, 'mug').map((p) => p.id)).toEqual([1]);
    expect(filterProducts(products, 'WOOL').map((p) => p.id)).toEqual([2]);
    expect(filterProducts(products, '  ')).toHaveLength(2);
  });
});
