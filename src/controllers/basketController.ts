import { type Response, Router } from 'express';
import { z } from 'zod';
import {
  changeBasketQuantity,
  getBasket,
  quantityInBasket,
} from '../services/basketService';
import basketPage from '../views/pages/basket/basket_page';
import { requireLogin } from './sessionController';

const router = Router();
router.use(requireLogin);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function renderBasket(res: Response, status = 200, error?: string) {
  const basket = await getBasket(res.locals.accessToken, res.locals.customerId);
  const products = basket.basket.map((item) => ({
    basketID: item.basketID,
    name: item.product.productName,
    quantity: item.quantity,
    canIncrease:
      quantityInBasket(basket.basket, item.productID) <
      item.product.productStock,
    stock: item.product.productStock,
    totalPrice: `£${(item.product.productPrice * item.quantity).toFixed(2)}`,
    image: {
      src: `/images/products_images/${item.product.productImage.split('/').pop()}`,
      alt: item.product.productName,
    },
  }));
  const total = basket.basket.reduce(
    (sum, item) => sum + item.product.productPrice * item.quantity,
    0,
  );
  res.status(basket.ok ? status : 502).render('basket/basket', {
    page: { ...basketPage, products, basketTotal: `£${total.toFixed(2)}` },
    error: basket.ok ? error : basket.message,
  });
}

router.get('/', async (_req, res) => {
  await renderBasket(res);
});

router.post('/:id/quantity', async (req, res) => {
  const id = z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.int32().positive())
    .safeParse(req.params.id);
  const direction = z
    .enum(['increase', 'decrease'])
    .safeParse(req.body?.direction);
  if (!id.success || !direction.success) {
    await renderBasket(res, 400, 'Invalid quantity update.');
    return;
  }
  const result = await changeBasketQuantity(
    res.locals.accessToken,
    id.data,
    direction.data === 'increase' ? 1 : -1,
  );
  if (!result.ok) {
    await renderBasket(res, result.status, result.message);
    return;
  }
  res.redirect(303, '/basket');
});

export default router;
