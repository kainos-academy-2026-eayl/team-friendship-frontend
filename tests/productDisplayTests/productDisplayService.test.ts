import { afterEach, expect, test, vi } from 'vitest';

import { getProduct } from '../../src/services/productDisplayServices';

afterEach(() => {
  vi.restoreAllMocks();
});

test('getProduct returns a mapped product when backend returns valid data', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        product: {
          productID: 40,
          productName: 'Marble',
          productDescription:
            'Bold and shiny, perfect for all your taskmaster needs',
          productPrice: 30.88,
          productImage: 'products_images/marble.jpeg',
          productStock: 10,
        },
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    ),
  );

  const result = await getProduct('http://localhost:3000', 40);

  expect(result.ok).toBe(true);

  if (result.ok) {
    expect(result.product).toEqual({
      id: 40,
      name: 'Marble',
      description: 'Bold and shiny, perfect for all your taskmaster needs',
      price: '30.88',
      imageUrl: '/images/products_images/marble.jpeg',
      stock: 10,
    });
  }
});

test('getProduct returns failure when backend returns non-success status', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(null, { status: 404 }),
  );

  const result = await getProduct('http://localhost:3000', 999);

  expect(result).toEqual({
    ok: false,
    message: 'Unable to load product.',
  });
});

test('getProduct returns failure when backend response is invalid', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        invalid: true,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    ),
  );

  const result = await getProduct('http://localhost:3000', 40);

  expect(result).toEqual({
    ok: false,
    message: 'Unable to load product.',
  });
});

test('getProduct returns failure when backend response is invalid', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        invalid: true,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      },
    ),
  );

  const result = await getProduct('http://localhost:3000', 40);

  expect(result).toEqual({
    ok: false,
    message: 'Unable to load product.',
  });
});

test('getProduct returns failure when fetch throws', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));

  const result = await getProduct('http://localhost:3000', 40);

  expect(result).toEqual({
    ok: false,
    message: 'Unable to reach the server. Please try again.',
  });
});
