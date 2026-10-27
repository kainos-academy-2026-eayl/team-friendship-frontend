import { resolve } from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import loginController from './controllers/loginController';
import registerController from './controllers/registerController';
import basketPage from './views/pages/basket/basket_page';
import forgotPasswordPage from './views/pages/forget_password/forget_password_page';
import homePage from './views/pages/home/home_page';
import productPage from './views/pages/product_display/product_display_page';

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

  app.get('/product_display', (_req: Request, res: Response) => {
    res.render('product_display/product_display', { page: productPage });
  });

  app.get('/forgot_password', (_req: Request, res: Response) => {
    res.render('forget_password/forgot_password', {
      page: forgotPasswordPage,
    });
  });

  return app;
}
