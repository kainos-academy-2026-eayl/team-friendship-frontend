import express, { type Express, type Request, type Response } from 'express';
import nunjucks from 'nunjucks';
import loginPage from '../pages/login';

export function createApp(): Express {
  const app = express();

  nunjucks.configure(['pages', 'src/register'], {
    autoescape: true,
    express: app,
  });

  app.set('view engine', 'njk');

  app.use(express.static('pages'));

  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/login');
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/login', (_req: Request, res: Response) => {
    res.render('login', { page: loginPage });
  });

  app.get('/register', (_req: Request, res: Response) => {
    res.render('register');
  });

  app.get('/register.css', (_req: Request, res: Response) => {
    res.sendFile('src/register/register.css', { root: process.cwd() });
  });

  app.get('/register.js', (_req: Request, res: Response) => {
    res.sendFile('dist/register.js', { root: process.cwd() });
  });

  return app;
}
