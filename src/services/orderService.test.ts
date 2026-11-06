import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOrder,
  getOrder,
  getOrderHistory,
  orderTotal,
} from './orderService';

const API = 'http://api.test';
const TOKEN = 'access-token';

const backendOrder = {
  orderID: 7,
  customerID: 3,
  dateCreated: '2026-11-04T12:00:00.000Z',
  status: 'pending',
  address: '123 Town Street',
  postcode: 'BT16 AAA',
  discountCode: null,
  discountAmount: 0,
  orderServices: [
    {
      orderID: 7,
      productID: 1,
      quantity: 2,
      product: {
        productID: 1,
        productName: 'Blue Mug',
        productDescription: 'A ceramic mug',
        productCategory: 'Kitchen',
        productPrice: 7.5,
        productImage: '/images/mug.png',
        productStock: 1,
      },
    },
  ],
};

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createOrder', () => {
  it('POSTs the order with a bearer token and parses the response', async () => {
    const fetchMock = mockFetch({ order: backendOrder }, 201);

    const result = await createOrder(API, TOKEN, 3, [
      { productID: 1, quantity: 2 },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(`${API}/orders`, {
      method: 'POST',
      body: JSON.stringify({
        customerID: 3,
        orderServices: [{ productID: 1, quantity: 2 }],
      }),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
    });
    expect(result).toEqual({
      ok: true,
      order: {
        ...backendOrder,
        dateCreated: new Date('2026-11-04T12:00:00.000Z'),
      },
    });
  });

  it('sends an alternative delivery address when one is given', async () => {
    const fetchMock = mockFetch({ order: backendOrder }, 201);

    await createOrder(API, TOKEN, 3, [{ productID: 1, quantity: 2 }], {
      deliveryAddress: { address: '14 Gift Lane', postcode: 'BT9 5AB' },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      customerID: 3,
      address: '14 Gift Lane',
      postcode: 'BT9 5AB',
      orderServices: [{ productID: 1, quantity: 2 }],
    });
  });

  it('sends a discount code when one is given', async () => {
    const fetchMock = mockFetch(
      {
        order: {
          ...backendOrder,
          discountCode: 'FRIENDSHIP12',
          discountAmount: 1.8,
        },
      },
      201,
    );

    const result = await createOrder(
      API,
      TOKEN,
      3,
      [{ productID: 1, quantity: 2 }],
      { discountCode: 'FRIENDSHIP12' },
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      customerID: 3,
      discountCode: 'FRIENDSHIP12',
      orderServices: [{ productID: 1, quantity: 2 }],
    });
    expect(result.ok && result.order.discountAmount).toBe(1.8);
  });

  it('surfaces backend error messages such as insufficient stock', async () => {
    mockFetch({ error: 'Not enough stock for product 1', productID: 1 }, 409);

    const result = await createOrder(API, TOKEN, 3, [
      { productID: 1, quantity: 99 },
    ]);

    expect(result).toEqual({
      ok: false,
      status: 409,
      message: 'Not enough stock for product 1',
    });
  });

  it('asks the user to log in when unauthenticated', async () => {
    mockFetch({ error: 'Authentication required' }, 401);

    const result = await createOrder(API, TOKEN, 3, [
      { productID: 1, quantity: 1 },
    ]);

    expect(result).toEqual({
      ok: false,
      status: 401,
      message: 'Please log in to continue.',
    });
  });

  it('reports when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const result = await createOrder(API, TOKEN, 3, [
      { productID: 1, quantity: 1 },
    ]);

    expect(result).toMatchObject({ ok: false, status: 503 });
  });
});

describe('getOrder', () => {
  it('fetches a single order', async () => {
    const fetchMock = mockFetch({ order: backendOrder });

    const result = await getOrder(API, TOKEN, 7);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API}/orders/7`);
    expect(result.ok && result.order.orderID).toBe(7);
  });

  it('rejects malformed responses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch({ order: { ...backendOrder, orderID: 'seven' } });

    const result = await getOrder(API, TOKEN, 7);

    expect(result).toEqual({
      ok: false,
      status: 502,
      message: 'Unable to load this order.',
    });
  });
});

describe('getOrderHistory', () => {
  it('fetches the customer order list', async () => {
    const fetchMock = mockFetch({ orders: [backendOrder] });

    const result = await getOrderHistory(API, TOKEN, 3);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API}/users/3/orders`);
    expect(result.ok && result.orders).toHaveLength(1);
  });

  it('uses a fallback message when the error body is empty', async () => {
    mockFetch({}, 500);

    const result = await getOrderHistory(API, TOKEN, 3);

    expect(result).toEqual({
      ok: false,
      status: 500,
      message: 'Unable to load your order history.',
    });
  });
});

describe('orderTotal', () => {
  it('sums price multiplied by quantity across lines', async () => {
    mockFetch({ order: backendOrder });
    const result = await getOrder(API, TOKEN, 7);
    if (!result.ok) throw new Error('expected order');

    expect(orderTotal(result.order)).toBe(15);
  });
});
