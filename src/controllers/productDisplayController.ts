import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
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

  const result = await getProduct(
    process.env.BACKEND_URL ?? 'http://localhost:3000',
    params.data.id,
  );

  if (!result.ok) {
    res.status(404).render('product_display/product_display', {
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

export default router;
