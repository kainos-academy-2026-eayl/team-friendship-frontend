import { z } from 'zod';
import type {
  CreateOrderRequest,
  Order,
  OrderFailure,
  OrderItem,
  OrderResult,
  OrdersResult,
} from '../models/orderModel';

const orderProductSchema = z.object({
  productID: z.number().int().positive(),
  productName: z.string(),
  productDescription: z.string(),
  productCategory: z.string(),
  productPrice: z.number().nonnegative(),
  productImage: z.string(),
  productStock: z.number().int().nonnegative(),
});

const orderServiceSchema = z.object({
  orderID: z.number().int().positive(),
  productID: z.number().int().positive(),
  quantity: z.number().int().positive(),
  product: orderProductSchema,
});

const orderSchema = z.object({
  orderID: z.number().int().positive(),
  customerID: z.number().int().positive(),
  dateCreated: z.iso.datetime().transform((value) => new Date(value)),
  status: z.string(),
  orderServices: z.array(orderServiceSchema),
}) satisfies z.ZodType<Order>;

const orderResponseSchema = z.object({ order: orderSchema });
const ordersResponseSchema = z.object({ orders: z.array(orderSchema) });

const errorBodySchema = z.object({ error: z.string().optional() });

const UNREACHABLE_MESSAGE = 'Unable to reach the server. Please try again.';

async function failure(
  response: Response,
  fallback: string,
): Promise<OrderFailure> {
  if (response.status === 401) {
    return {
      ok: false,
      status: 401,
      message: 'Please log in to continue.',
    };
  }
  const body = errorBodySchema.safeParse(
    await response.json().catch(() => ({})),
  );
  return {
    ok: false,
    status: response.status,
    message: (body.success && body.data.error) || fallback,
  };
}

async function orderRequest<T>(
  url: string,
  accessToken: string,
  schema: z.ZodType<T>,
  fallback: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | OrderFailure> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      return failure(response, fallback);
    }

    const result = schema.safeParse(await response.json());
    if (!result.success) {
      console.error('Unexpected order response', z.flattenError(result.error));
      return { ok: false, status: 502, message: fallback };
    }
    return { ok: true, data: result.data };
  } catch {
    return { ok: false, status: 503, message: UNREACHABLE_MESSAGE };
  }
}

export async function createOrder(
  apiUrl: string,
  accessToken: string,
  customerID: number,
  items: OrderItem[],
): Promise<OrderResult> {
  const payload: CreateOrderRequest = { customerID, orderServices: items };
  const result = await orderRequest(
    `${apiUrl}/orders`,
    accessToken,
    orderResponseSchema,
    'Unable to place your order.',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return result.ok ? { ok: true, order: result.data.order } : result;
}

export async function getOrder(
  apiUrl: string,
  accessToken: string,
  orderID: number,
): Promise<OrderResult> {
  const result = await orderRequest(
    `${apiUrl}/orders/${encodeURIComponent(orderID)}`,
    accessToken,
    orderResponseSchema,
    'Unable to load this order.',
  );
  return result.ok ? { ok: true, order: result.data.order } : result;
}

export async function getOrderHistory(
  apiUrl: string,
  accessToken: string,
  customerID: number,
): Promise<OrdersResult> {
  const result = await orderRequest(
    `${apiUrl}/users/${encodeURIComponent(customerID)}/orders`,
    accessToken,
    ordersResponseSchema,
    'Unable to load your order history.',
  );
  return result.ok ? { ok: true, orders: result.data.orders } : result;
}

export function orderTotal(order: Order): number {
  return order.orderServices.reduce(
    (total, line) => total + line.product.productPrice * line.quantity,
    0,
  );
}
