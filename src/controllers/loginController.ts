import { type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { type LoginCredentials, login } from '../services/loginService';
import loginPage from '../views/pages/login/login_page';
import {
  backendUrl,
  safeReturnTo,
  setSessionCookies,
} from './sessionController';

const router = Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).render('login/login', {
      page: loginPage,
      error: 'Too many login attempts. Please try again later.',
    }),
});

router.get('/', (req: Request, res: Response) => {
  const error =
    typeof req.query.error === 'string' ? req.query.error : undefined;
  const success =
    typeof req.query.success === 'string' ? req.query.success : undefined;
  const returnTo = safeReturnTo(req.query.returnTo);
  res.render('login/login', { page: loginPage, error, success, returnTo });
});

router.post('/', loginRateLimit, async (req: Request, res: Response) => {
  const { returnTo: rawReturnTo, ...body } =
    req.body && typeof req.body === 'object' ? req.body : {};
  const returnTo = safeReturnTo(rawReturnTo);
  const credentials = Object.fromEntries(
    Object.entries(body).filter(([, value]) => typeof value === 'string'),
  ) as LoginCredentials;
  const result = await login(backendUrl(), credentials);

  if (!result.ok) {
    res.render('login/login', {
      page: loginPage,
      error: result.message,
      returnTo,
    });
    return;
  }

  setSessionCookies(res, result.tokens);
  res.redirect(returnTo ?? '/product_browse');
});

export default router;
