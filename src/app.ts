import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import forgotPasswordPage from '../pages/forgot_password';
import loginPage from '../pages/login';
import productPage from '../pages/product_display';
import registerPage from '../pages/register';

export function createApp(): Express {
  const app = express();

  nunjucks.configure('pages', {
    autoescape: true,
    express: app,
  });

  app.set('view engine', 'njk');

  app.use(express.static('pages'));

  app.get('/', (_req, res) => {
    res.redirect('/login');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/login', (_req, res) => {
    res.render('login', { page: loginPage });
  });

  app.get('/basket', (_req: Request, res: Response) => {
    res.render('basket', { page: basketPage });
  });

  app.get('/register', (_req: Request, res: Response) => {
    res.render('register', { page: registerPage });
  });

  app.get('/product_display', (_req: Request, res: Response) => {
    res.render('product_display', { page: productPage });
  });

  app.get('/forgot_password', (_req: Request, res: Response) => {
    res.render('forgot_password', { page: forgotPasswordPage });
  });

  return app;
}
