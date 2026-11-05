import { Router } from 'express';
import homePage from '../views/pages/home/home_page';

const router = Router();
router.get('/', (_req, res) => {
  res.render('home/home', { page: homePage });
});

export default router;
