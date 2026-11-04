import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filterProducts,
  filterProductsByCategory,
  getCategories,
  getProducts,
  sortProducts,
} from '../src/services/productService.ts';

const backendProduct = {
  productID: 1,
  productName: 'Blue Mug',
  productDescription: 'A ceramic mug',
  productCategory: 'Kitchen',
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
          category: 'Kitchen',
          price: '7.50',
          imageUrl: '/images/products_images/mug.png',
          stock: 3,
        },
      ],
    });
  });

  it('rejects responses that fail schema validation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
        category: 'Kitchen',
        price: '1.00',
        imageUrl: '',
        stock: 1,
      },
      {
        id: 2,
        name: 'Red Hat',
        description: 'Woollen',
        category: 'Clothing',
        price: '2.00',
        imageUrl: '',
        stock: 1,
      },
    ];

    expect(filterProducts(products, 'mug').map((p) => p.id)).toEqual([1]);
    expect(filterProducts(products, 'WOOL').map((p) => p.id)).toEqual([2]);
    expect(filterProducts(products, '  ')).toHaveLength(2);
  });

  it('sorts products by category ascending and descending', () => {
    const base = { description: '', price: '1.00', imageUrl: '', stock: 1 };
    const products = [
      { ...base, id: 1, name: 'Mug', category: 'Kitchen' },
      { ...base, id: 2, name: 'Hat', category: 'clothing' },
      { ...base, id: 3, name: 'Bowl', category: 'Kitchen' },
    ];

    expect(sortProducts(products, 'category-asc').map((p) => p.id)).toEqual([
      2, 3, 1,
    ]);
    expect(sortProducts(products, 'category-desc').map((p) => p.id)).toEqual([
      3, 1, 2,
    ]);
    expect(sortProducts(products, undefined)).toBe(products);
    expect(products.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('filters products by category name, case-insensitively', () => {
    const base = { description: '', price: '1.00', imageUrl: '', stock: 1 };
    const products = [
      { ...base, id: 1, name: 'Lego', category: 'Toys' },
      { ...base, id: 2, name: 'Catan', category: 'Board Games' },
      { ...base, id: 3, name: 'Furby', category: 'toys' },
    ];

    expect(filterProductsByCategory(products, 'Toys').map((p) => p.id)).toEqual(
      [1, 3],
    );
    expect(filterProductsByCategory(products, '')).toHaveLength(3);
    expect(filterProductsByCategory(products, undefined)).toHaveLength(3);
    expect(getCategories(products)).toEqual(['Board Games', 'Toys']);
  });
});
