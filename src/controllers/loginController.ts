import { type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { LoginCredentials } from '../models/loginModel';
import {
  getLoginPage,
  login,
  loginFieldNames,
  loginPasswordFieldNames,
} from '../services/loginService';
import {
  getPasswordState,
  isPasswordVisibilityField,
} from '../services/passwordVisibilityService';
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
  handler: (req, res) =>
    res.status(429).render('login/login', {
      page: getLoginPage(),
      returnTo: safeReturnTo(req.body?.returnTo),
      error: 'Too many login attempts. Please try again later.',
    }),
});

router.get('/', (req: Request, res: Response) => {
  const error =
    typeof req.query.error === 'string' ? req.query.error : undefined;
  const success =
    typeof req.query.success === 'string' ? req.query.success : undefined;
  res.render('login/login', {
    page: getLoginPage(),
    error,
    success,
    returnTo: safeReturnTo(req.query.returnTo),
  });
});

router.post('/toggle-password', (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const passwordState = getPasswordState(
    body,
    loginFieldNames,
    loginPasswordFieldNames,
  );

  res.set('Cache-Control', 'no-store');
  res.render('login/login', {
    page: getLoginPage(passwordState),
    returnTo: safeReturnTo(body.returnTo),
  });
});

router.post('/', loginRateLimit, async (req: Request, res: Response) => {
  const { returnTo: rawReturnTo, ...body } =
    req.body && typeof req.body === 'object' ? req.body : {};
  const returnTo = safeReturnTo(rawReturnTo);
  const credentials = Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) =>
        typeof value === 'string' && !isPasswordVisibilityField(key),
    ),
  ) as LoginCredentials;
  const result = await login(backendUrl(), credentials);

  if (!result.ok) {
    res.render('login/login', {
      page: getLoginPage(),
      error: result.message,
      returnTo,
    });
    return;
  }

  setSessionCookies(res, result.tokens);
  res.redirect(result.isAdmin ? '/admin' : (returnTo ?? '/product_browse'));
});

export default router;
