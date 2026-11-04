import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import forgotPasswordController from './controllers/forgot-password-controller';
import loginController from './controllers/loginController';
import logoutController from './controllers/logoutController';
import { requireSameOrigin } from './controllers/originGuard';
import productController from './controllers/productController';
import registerController from './controllers/registerController';
import resetPasswordController from './controllers/resetPasswordController';
import { loadSession, requireLogin } from './controllers/sessionController';
import basketPage from './views/pages/basket/basket_page';
import checkoutPage from './views/pages/checkout/checkout';
import homePage from './views/pages/home/home_page';
import orderHistoryPage from './views/pages/order_history/order_history';
import registerPage from './views/pages/register/register_page';
import sidebarNavigation from './views/partials/sidebar_navigation';

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
  app.use('/register', registerController);

  app.get('/', (_req, res) => {
    res.redirect('/home');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/home', (_req, res) => {
    res.render('home/home', { page: homePage });
  });

  app.get('/basket', requireLogin, (_req: Request, res: Response) => {
    res.render('basket/basket', { page: basketPage });
  });

  app.get('/checkout', requireLogin, (_req: Request, res: Response) => {
    res.render('checkout/checkout', { page: checkoutPage });
  });

  app.get('/register', (_req: Request, res: Response) => {
    res.render('register/register', { page: registerPage });
  });

  app.get('/product_display', async (_req: Request, res: Response) => {
    try {
      const response = await fetch(
        `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/products`,
      );

      if (!response.ok) {
        throw new Error('Unable to load products');
      }

      const data = await response.json();

      res.render('product_display/product_display', {
        page: { title: 'Products' },
        products: data.products,
      });
    } catch {
      res.render('product_display/product_display', {
        page: { title: 'Products' },
        products: [],
      });
    }
  });

  app.use('/product_browse', productController);

  app.use('/forgot_password', forgotPasswordController);

  app.use('/reset_password', resetPasswordController);

  app.get('/order_history', requireLogin, (_req: Request, res: Response) => {
    res.render('order_history/order_history', { page: orderHistoryPage });
  });

  return app;
}
