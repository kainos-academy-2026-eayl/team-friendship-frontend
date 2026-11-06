import { Router } from 'express';
import { z } from 'zod';
import { getOrderConfirmation } from '../services/orderConfirmationService';
import { backendUrl, requireLogin } from './sessionController';

const router = Router();
const page = { title: 'Order confirmation' };
const orderIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive());

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireLogin);
router.get('/:id', async (req, res) => {
  if (!res.locals.customerId) {
    res.status(403).render('order_confirmation/order_confirmation', {
      page,
      error: 'A customer account is required to view order details.',
    });
    return;
  }
  const id = orderIdSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).render('order_confirmation/order_confirmation', {
      page,
      error: 'Invalid order reference.',
    });
    return;
  }
  const result = await getOrderConfirmation(
    backendUrl(),
    res.locals.accessToken,
    res.locals.customerId,
    id.data,
  );
  if (!result.ok) {
    res.status(result.status).render('order_confirmation/order_confirmation', {
      page,
      error: result.message,
    });
    return;
  }
  res.render('order_confirmation/order_confirmation', {
    page,
    order: result.order,
  });
});

export default router;
