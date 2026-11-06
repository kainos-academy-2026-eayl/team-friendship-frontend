import { z } from 'zod';
import { confirmationOrderSchema } from '../models/orderConfirmationModel';

export async function getOrderConfirmation(
  apiUrl: string,
  accessToken: string,
  customerId: number,
  orderId: number,
) {
  try {
    const response = await fetch(`${apiUrl}/orders/${orderId}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const status = [401, 403, 404].includes(response.status)
        ? response.status
        : 502;
      console.error('Order confirmation request failed', response.status);
      return {
        ok: false as const,
        status,
        message:
          status === 404
            ? 'This order could not be found.'
            : 'Unable to load your order. Please try again later.',
      };
    }
    const result = z
      .object({ order: confirmationOrderSchema })
      .safeParse(await response.json());
    if (!result.success) {
      console.error(
        'Invalid order confirmation response',
        z.flattenError(result.error),
      );
      return {
        ok: false as const,
        status: 502,
        message: 'The order service returned an invalid response.',
      };
    }
    const order = result.data.order;
    if (order.customerID !== customerId || order.orderID !== orderId) {
      console.error(
        'Order confirmation response does not match the requested customer and order.',
      );
      return {
        ok: false as const,
        status: 404,
        message: 'This order could not be found.',
      };
    }
    return {
      ok: true as const,
      order: {
        reference: order.orderID,
        status: order.status,
        pending: order.status.toLowerCase() === 'pending',
        date: new Intl.DateTimeFormat('en-GB', {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'Europe/London',
        }).format(new Date(order.dateCreated)),
        items: order.orderServices.map((item) => ({
          name: item.product.productName,
          quantity: item.quantity,
        })),
      },
    };
  } catch (error) {
    console.error('Unable to fetch order confirmation', error);
    return {
      ok: false as const,
      status: 502,
      message: 'Unable to reach the order service. Please try again later.',
    };
  }
}
