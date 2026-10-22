import express, { type Express } from 'express';
import nunjucks from 'nunjucks';
import basketPage from '../pages/basket';
import forgotPasswordPage from '../pages/forgot_password';
import loginPage from '../pages/login';
import productPage from '../pages/product_display';

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

  app.get('/product_display', (_req, res) => {
    res.render('product_display', { page: productPage });
  });

  app.get('/basket', (_req, res) => {
    res.render('basket', { page: basketPage });
  });

  app.get('/forgot_password', (_req, res) => {
    res.render('forgot_password', { page: forgotPasswordPage });
  });

  return app;
}
