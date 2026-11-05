import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import adminController from './controllers/adminController';
import forgotPasswordController from './controllers/forgot-password-controller';
import loginController from './controllers/loginController';
import logoutController from './controllers/logoutController';
import { requireSameOrigin } from './controllers/originGuard';
import productController from './controllers/productController';
import productDisplayController from './controllers/productDisplayController';
import registerController from './controllers/registerController';
import resetPasswordController from './controllers/resetPasswordController';
import { loadSession, requireLogin } from './controllers/sessionController';
import basketPage from './views/pages/basket/basket_page';
import checkoutPage from './views/pages/checkout/checkout';
import homePage from './views/pages/home/home_page';
import orderHistoryPage from './views/pages/order_history/order_history';
import registerPage from './views/pages/register/register_page';
import sidebarNavigation from './views/partials/sidebar_navigation';
import { getBasket } from './services/basketService';

export function createApp(): Express {
  const app = express();
  const viewsDirectory = resolve(process.cwd(), 'src/views');

  nunjucks.configure([resolve(viewsDirectory, 'pages'), viewsDirectory], {
    autoescape: true,
    express: app,
  });

  app.set('view engine', 'njk');

  app.use(express.static(resolve(process.cwd(), 'public')));
  app.use(cookieParser());
  app.use(requireSameOrigin);
  // Before loadSession so logout revokes the existing refresh token instead of rotating it first.
  app.use('/logout', logoutController);
  app.use(loadSession);

  app.use((req, res, next) => {
    res.locals.navigation = sidebarNavigation;
    res.locals.currentPath = req.path;
    next();
  });

  app.use(express.urlencoded({ extended: false }));
  app.use('/login', loginController);
  app.use('/admin', adminController);
  app.use('/register', registerController);
  app.use('/products', productDisplayController);

  app.get('/', (_req, res) => {
    res.redirect('/home');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/home', (_req, res) => {
    res.render('home/home', { page: homePage });
  });

  app.get('/basket', async (_req: Request, res: Response) => {
    const customerId = 1;
    const basket = await getBasket(customerId);

    const products = basket.basket.map((item: any) => ({
      name: item.product.productName,
      quantity: String(item.quantity),
      totalPrice: `£${(
        item.product.productPrice * item.quantity
      ).toFixed(2)}`,
      image: {
        src: `/images/${item.product.productImage}`,
        alt: item.product.productName,
      },
    }));

    const basketTotal = basket.basket.reduce(
      (total: number, item: any) =>
        total + item.product.productPrice * item.quantity,
      0,
    );

    res.render('basket/basket', {
      page: {
        ...basketPage,
        products,
        basketTotal: `£${basketTotal.toFixed(2)}`,
      },
    });
  });

  app.get('/checkout', requireLogin, (_req: Request, res: Response) => {
    res.render('checkout/checkout', { page: checkoutPage });
  });

  app.get('/register', (_req: Request, res: Response) => {
    res.render('register/register', { page: registerPage });
  });

  app.use('/product_browse', productController);

  app.use('/forgot_password', forgotPasswordController);

  app.use('/reset_password', requireLogin, resetPasswordController);

  app.get('/order_history', requireLogin, (_req: Request, res: Response) => {
    res.render('order_history/order_history', { page: orderHistoryPage });
  });

  return app;
};
