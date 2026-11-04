import { type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  getLoginPage,
  type LoginCredentials,
  login,
  loginFieldNames,
  loginPasswordFieldNames,
} from '../services/loginService';
import {
  getPasswordState,
  isPasswordVisibilityField,
} from '../services/passwordVisibilityService';

const router = Router();
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).render('login/login', {
      page: getLoginPage(),
      error: 'Too many login attempts. Please try again later.',
    }),
});

router.get('/', (req: Request, res: Response) => {
  const error =
    typeof req.query.error === 'string' ? req.query.error : undefined;
  const success =
    typeof req.query.success === 'string' ? req.query.success : undefined;
  res.render('login/login', { page: getLoginPage(), error, success });
});

router.post('/toggle-password', (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const passwordState = getPasswordState(
    body,
    loginFieldNames,
    loginPasswordFieldNames,
  );

  res.set('Cache-Control', 'no-store');
  res.render('login/login', { page: getLoginPage(passwordState) });
});

router.post('/', loginRateLimit, async (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const credentials = Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) =>
        typeof value === 'string' && !isPasswordVisibilityField(key),
    ),
  ) as LoginCredentials;
  const result = await login(
    process.env.BACKEND_URL ?? 'http://localhost:3000',
    credentials,
  );

  if (!result.ok) {
    res.render('login/login', { page: getLoginPage(), error: result.message });
    return;
  }

  res.redirect('/product_browse');
});

export default router;
