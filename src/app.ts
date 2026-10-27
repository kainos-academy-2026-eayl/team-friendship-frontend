import { resolve } from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import basketPage from './static_content_pages/basket_service';
import forgotPasswordPage from './static_content_pages/forgot_password_service';
import homePage from './static_content_pages/home_service';
import loginPage from './static_content_pages/login_service';
import productPage from './static_content_pages/product_display_service';
import registerPage from './static_content_pages/register_service';

export function createApp(): Express {
  const app = express();
  const viewsDirectory = resolve(process.cwd(), 'src/views');
  const apiUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';

  nunjucks.configure([resolve(viewsDirectory, 'pages'), viewsDirectory], {
    autoescape: true,
    express: app,
  });

  app.set('view engine', 'njk');

  app.use(express.static(resolve(process.cwd(), 'public')));

  app.get('/', (_req, res) => {
    res.redirect('/home');
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/login', (_req, res) => {
    res.render('login', { page: loginPage, apiUrl });
  });

  app.get('/home', (_req, res) => {
    res.render('home', { page: homePage });
  });

  app.get('/basket', (_req: Request, res: Response) => {
    res.render('basket', { page: basketPage });
  });

  app.get('/register', (_req: Request, res: Response) => {
    res.render('register', { page: registerPage, apiUrl });
  });

  app.get('/product_display', (_req: Request, res: Response) => {
    res.render('product_display', { page: productPage });
  });

  app.get('/forgot_password', (_req: Request, res: Response) => {
    res.render('forgot_password', { page: forgotPasswordPage });
  });

  return app;
}
