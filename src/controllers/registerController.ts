import { type Request, type Response, Router } from 'express';
import type { RegistrationData } from '../models/registerModel';
import { passwordsMatch, register } from '../services/registerService';
import registerPage from '../views/pages/register/register_page';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const error =
    typeof req.query.error === 'string' ? req.query.error : undefined;
  const success =
    typeof req.query.success === 'string' ? req.query.success : undefined;
  res.render('register/register', { page: registerPage, error, success });
});

router.post('/', async (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const data = Object.fromEntries(
    Object.entries(body).filter(([, value]) => typeof value === 'string'),
  ) as RegistrationData;

  if (!passwordsMatch(data)) {
    res.status(400).render('register/register', {
      page: registerPage,
      passwordError: 'Passwords do not match.',
    });
    return;
  }

  const result = await register(
    process.env.BACKEND_URL ?? 'http://localhost:3000',
    data,
  );

  if (!result.ok) {
    res.render('register/register', {
      page: registerPage,
      error: result.message,
    });
    return;
  }

  res.redirect(`/login?success=${encodeURIComponent(result.message)}`);
});

export default router;
