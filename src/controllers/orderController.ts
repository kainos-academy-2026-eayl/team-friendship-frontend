import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import type { Order } from '../models/orderModel';
import { getOrder, orderTotal } from '../services/orderService';
import orderConfirmationPage from '../views/pages/order_confirmation/order_confirmation';
import { backendUrl, requireLogin } from './sessionController';

const router = Router();

const orderIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

function orderView(order: Order) {
  return {
    orderID: order.orderID,
    date: dateFormatter.format(order.dateCreated),
    status: order.status,
    lines: order.orderServices.map((line) => ({
      name: line.product.productName,
      quantity: line.quantity,
      lineTotal: formatPrice(line.product.productPrice * line.quantity),
    })),
    total: formatPrice(orderTotal(order)),
  };
}

function renderError(res: Response, status: number, error: string): void {
  res.status(status).render('order_confirmation/order_confirmation', {
    page: orderConfirmationPage,
    error,
  });
}

router.get('/:id', requireLogin, async (req: Request, res: Response) => {
  const params = orderIdSchema.safeParse(req.params);
  if (!params.success) {
    renderError(res, 400, 'Invalid order id.');
    return;
  }

  const result = await getOrder(
    backendUrl(),
    res.locals.accessToken,
    params.data.id,
  );
  if (!result.ok) {
    if (result.status === 401) {
      res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    // A 403 means another customer's order; report it as not found so IDs can't be probed.
    if (result.status === 403 || result.status === 404) {
      renderError(res, 404, 'Order not found.');
      return;
    }
    renderError(res, 502, result.message);
    return;
  }

  res.render('order_confirmation/order_confirmation', {
    page: orderConfirmationPage,
    order: orderView(result.order),
  });
});

export default router;
