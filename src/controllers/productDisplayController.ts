import cors from 'cors';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { getProducts } from '../services/productService';
import productDisplayPage from '../views/pages/product_display/product_display';

const router = Router();

router.use(cors());





export default router;
