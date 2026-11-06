import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import type { Product } from '../models/productDisplayModel';
import {
  addToBasket,
  type GetBasketResult,
  getBasket,
  quantityInBasket,
} from '../services/basketService';
import { getProduct } from '../services/productDisplayServices';
import productDisplay from '../views/pages/product_display/product_display_page';
import { requireLogin } from './sessionController';

const router = Router();

const productIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

async function availability(res: Response, product: Product) {
  if (!res.locals.isLoggedIn)
    return { remainingStock: product.stock, inBasket: 0 };
  const basket: GetBasketResult =
    res.locals.basketResult ??
    (await getBasket(res.locals.accessToken, res.locals.customerId));
  if (!basket.ok)
    return {
      remainingStock: 0,
      inBasket: undefined,
      error: 'Unable to check your basket. Reload before adding this product.',
    };
  return {
    inBasket: quantityInBasket(basket.basket, product.id),
    remainingStock: Math.max(
      0,
      product.stock - quantityInBasket(basket.basket, product.id),
    ),
  };
}

router.get('/:id', async (req: Request, res: Response) => {
  const params = productIdSchema.safeParse(req.params);

  if (!params.success) {
    res.status(400).render('product_display/product_display', {
      page: productDisplay,
      error: 'Invalid product id',
    });
    return;
  }

  const result = await getProduct(params.data.id);

  if (!result.ok) {
    res.status(result.status).render('product_display/product_display', {
      page: productDisplay,
      error: result.message,
    });
    return;
  }

  res.render('product_display/product_display', {
    page: productDisplay,
    product: result.product,
    ...(await availability(res, result.product)),
  });
});

router.post('/:id/quantity', async (req, res) => {
  const params = productIdSchema.safeParse(req.params);
  const quantity = z.coerce
    .number()
    .int()
    .positive()
    .max(2147483647)
    .safeParse(req.body?.quantity);
  const direction = z
    .enum(['increase', 'decrease'])
    .safeParse(req.body?.direction);
  if (!params.success || !quantity.success || !direction.success) {
    res.status(400).render('product_display/product_display', {
      page: productDisplay,
      error: 'Invalid quantity selection. Reload the product and try again.',
    });
    return;
  }
  const result = await getProduct(params.data.id);
  if (!result.ok) {
    res.status(result.status).render('product_display/product_display', {
      page: productDisplay,
      error: result.message,
    });
    return;
  }
  const available = await availability(res, result.product);
  res.set('Cache-Control', 'no-store');
  res.render('product_display/product_display', {
    page: productDisplay,
    product: result.product,
    ...available,
    quantity: Math.max(
      1,
      Math.min(
        available.remainingStock,
        quantity.data + (direction.data === 'increase' ? 1 : -1),
      ),
    ),
  });
});

router.post(
  '/:id/add-to-basket',
  requireLogin,
  async (req: Request, res: Response) => {
    const params = productIdSchema.safeParse(req.params);
    const quantity = z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
      .safeParse(req.body?.quantity);
    if (!params.success || !quantity.success) {
      res.status(400).render('product_display/product_display', {
        page: productDisplay,
        error:
          'Choose a valid product and a whole-number quantity of at least 1.',
      });
      return;
    }
    const product = await getProduct(params.data.id);
    if (!product.ok) {
      res.status(product.status).render('product_display/product_display', {
        page: productDisplay,
        error: product.message,
      });
      return;
    }
    const available = await availability(res, product.product);
    if (available.error || quantity.data > available.remainingStock) {
      res
        .status(available.error ? 502 : 409)
        .render('product_display/product_display', {
          page: productDisplay,
          product: product.product,
          quantity: quantity.data,
          ...available,
          error:
            available.error ??
            'The selected quantity exceeds the available stock, including items already in your basket.',
        });
      return;
    }
    const result = await addToBasket(
      res.locals.accessToken,
      res.locals.customerId,
      params.data.id,
      quantity.data,
    );
    if (!result.ok) {
      delete res.locals.basketResult;
      res.status(result.status).render('product_display/product_display', {
        page: productDisplay,
        product: product.product,
        quantity: quantity.data,
        ...(await availability(res, product.product)),
        error: result.message,
      });
      return;
    }
    res.redirect(303, '/product_browse');
  },
);

export default router;
