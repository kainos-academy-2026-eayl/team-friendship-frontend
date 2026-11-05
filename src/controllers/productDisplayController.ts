import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { addToBasket } from '../services/basketService';
import { getProduct } from '../services/productDisplayServices';

import productDisplay from '../views/pages/product_display/product_display_page';

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

router.post('/:id/add-to-basket', async (req: Request, res: Response) => {
  const productID = Number(req.params.id);

  await addToBasket(1, productID, 1);

  res.redirect('/basket');
});

export default router;
