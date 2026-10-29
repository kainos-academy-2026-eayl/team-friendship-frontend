import { type Request, type Response, Router } from 'express';
import forgotPasswordPage from '../pages/forget_password/forget_password_page';

interface RecoveryApiResponse {
  message?: string;
  error?: string;
}

const router = Router();
const apiUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';

router.get('/', (req: Request, res: Response) => {
  const error = req.query.error as string | undefined;
  const message = req.query.message as string | undefined;

  res.render('forget_password/forgot_password', {
    page: forgotPasswordPage,
    error,
    message,
  });
});

router.post('/', async (req: Request, res: Response) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (!email) {
    return res.redirect(
      `/forgot_password?error=${encodeURIComponent('Please enter a valid email address.')}`,
    );
  }

  try {
    const response = await fetch(`${apiUrl}/forgot-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const data: RecoveryApiResponse = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error =
        data.error ?? data.message ?? 'Could not send the recovery email.';
      return res.redirect(
        `/forgot_password?error=${encodeURIComponent(error)}`,
      );
    }

    const message =
      data.message ??
      'If an account exists for this email, recovery instructions will be sent.';
    return res.redirect(
      `/forgot_password?message=${encodeURIComponent(message)}`,
    );
  } catch (error) {
    console.error('Failed to send the recovery email request.', error);
    return res.redirect(
      `/forgot_password?error=${encodeURIComponent('Unable to contact the recovery service. Please try again.')}`,
    );
  }
});

export default router;
