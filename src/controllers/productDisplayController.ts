import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getProduct } from '../services/productDisplayServices';
import productDisplay from '../views/pages/product_display/product_display_page';

export const productIdSchema = z.object({
  id: z.coerce
    .number({ error: 'Product id must be a number' })
    .int({ error: 'Product id must be a whole number' })
    .positive({ error: 'Product id must be positive' }),
});

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  const params = productIdSchema.safeParse(req.params);

  if (!params.success) {
    res.status(400).render('product_display/product_display', {
      page: productDisplay,
      error: z.flattenError(params.error).fieldErrors.id?.[0],
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
    page: {
      ...productDisplay,
      title: result.product.name,
      description: result.product.description,
      price: `£${result.product.price}`,
      availability:
        result.product.stock > 0
          ? `In Stock (${result.product.stock} available)`
          : 'Out of Stock',
      image: {
        src: result.product.imageUrl,
        alt: result.product.name,
      },
    },
  });
});

export default router;
