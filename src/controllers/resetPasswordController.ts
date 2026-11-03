import { type Request, type Response, Router } from 'express';
import {
  getResetPasswordPage,
  hasResetPasswordErrors,
  validateResetPassword,
} from '../services/resetPasswordService';

const router = Router();
const apiUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

router.get('/', (req: Request, res: Response) => {
  const email = asString(req.query.email);
  const token = asString(req.query.token);
  res.render(
    'forget_password/reset_password',
    getResetPasswordPage(email, token),
  );
});

router.post('/', async (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = asString(body.email);
  const token = asString(body.token);
  const newPassword = asString(body.newPassword);
  const errors = validateResetPassword(
    newPassword,
    asString(body.confirmPassword),
  );

  if (hasResetPasswordErrors(errors)) {
    res
      .status(400)
      .render(
        'forget_password/reset_password',
        getResetPasswordPage(email, token, errors),
      );
    return;
  }

  if (!token) {
    res.status(400).render('forget_password/reset_password', {
      ...getResetPasswordPage(email),
      message: 'This reset link is invalid or has expired. Request a new one.',
    });
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, token, password: newPassword }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      res.status(response.status).render('forget_password/reset_password', {
        ...getResetPasswordPage(email, token),
        message:
          (typeof result.error === 'string' && result.error) ||
          (typeof result.message === 'string' && result.message) ||
          'Could not reset your password. Please try again.',
      });
      return;
    }

    res.render('forget_password/reset_password', {
      ...getResetPasswordPage(email),
      message:
        result.message ?? 'Password reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Failed to send the password reset request.', error);
    res.status(502).render('forget_password/reset_password', {
      ...getResetPasswordPage(email, token),
      message: 'Unable to reach the password reset service. Please try again.',
    });
  }
});

export default router;
