import { type Request, type Response, Router } from 'express';
import { type LoginCredentials, login } from '../services/loginService';
import loginPage from '../views/pages/login/login_page';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const error =
    typeof req.query.error === 'string' ? req.query.error : undefined;
  const success =
    typeof req.query.success === 'string' ? req.query.success : undefined;
  res.render('login/login', { page: loginPage, error, success });
});

router.post('/', async (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const credentials = Object.fromEntries(
    Object.entries(body).filter(([, value]) => typeof value === 'string'),
  ) as LoginCredentials;
  const result = await login(
    process.env.BACKEND_URL ?? 'http://localhost:3000',
    credentials,
  );

  if (!result.ok) {
    res.render('login/login', { page: loginPage, error: result.message });
    return;
  }

  res.redirect('/home');
});

export default router;
