import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { addToBasket } from '../services/basketService';
import { getProduct } from '../services/productDisplayServices';
import productDisplay from '../views/pages/product_display/product_display_page';
import { requireLogin } from './sessionController';

const router = Router();

const productIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

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
    if (quantity.data > product.product.stock) {
      res.status(409).render('product_display/product_display', {
        page: productDisplay,
        product: product.product,
        quantity: quantity.data,
        error: 'The selected quantity exceeds the available stock.',
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
      res.status(result.status).render('product_display/product_display', {
        page: productDisplay,
        product: product.product,
        quantity: quantity.data,
        error: result.message,
      });
      return;
    }
    res.redirect(303, '/product_browse');
  },
);

export default router;
