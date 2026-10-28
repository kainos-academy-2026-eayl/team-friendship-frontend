import { resolve } from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import loginController from './controllers/loginController';
import registerController from './controllers/registerController';
import forgotPasswordController from './controllers/forgot-password-controller';
import basketPage from './views/pages/basket/basket_page';
import checkoutPage from './views/pages/checkout/checkout';
import homePage from './views/pages/home/home_page';
import productPage from './views/pages/product_display/product_display_page';
import registerPage from './views/pages/register/register_page';

export function createApp(): Express {
  const app = express();
  const viewsDirectory = resolve(process.cwd(), 'src/views');

  nunjucks.configure([resolve(viewsDirectory, 'pages'), viewsDirectory], {
    autoescape: true,
    express: app,
  });

  app.set('view engine', 'njk');

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(resolve(process.cwd(), 'public')));
  app.use('/login', loginController);
  app.use('/register', registerController);
  app.use(express.urlencoded({ extended: false }));

  app.get('/', (_req, res) => {
    res.redirect('/home');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/home', (_req, res) => {
    res.render('home/home', { page: homePage });
  });

  app.get('/basket', (_req: Request, res: Response) => {
    res.render('basket/basket', { page: basketPage });
  });

  app.get('/checkout', (_req: Request, res: Response) => {
    res.render('checkout/checkout', { page: checkoutPage });
  });

  app.get('/register', (_req: Request, res: Response) => {
    res.render('register/register', { page: registerPage });
  });

  app.get('/product_display', (_req: Request, res: Response) => {
    res.render('product_display/product_display', { page: productPage });
  });

  app.use('/forgot_password', forgotPasswordController);

  return app;
}
