import cors from 'cors';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { filterProducts, getProducts } from '../services/productService';
import productBrowse from '../views/pages/product_browse/product_browse';

export const productSearchSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, { error: 'Search term must be 100 characters or fewer' })
    .optional()
    .default(''),
});

const router = Router();

router.use(cors());

router.get('/', async (req: Request, res: Response) => {
  const query = productSearchSchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).render('product_browse/product_browse', {
      page: productBrowse,
      products: [],
      searchTerm: '',
      error: z.flattenError(query.error).fieldErrors.search?.[0],
    });
    return;
  }

  const searchTerm = query.data.search;
  const result = await getProducts(
    process.env.BACKEND_URL ?? 'http://localhost:3000',
  );

  if (!result.ok) {
    res.status(502).render('product_browse/product_browse', {
      page: productBrowse,
      products: [],
      searchTerm,
      error: result.message,
    });
    return;
  }

  res.render('product_browse/product_browse', {
    page: productBrowse,
    products: filterProducts(result.products, searchTerm),
    searchTerm,
  });
});

export default router;
