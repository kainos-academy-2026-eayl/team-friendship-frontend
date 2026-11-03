import { type Request, type Response, Router } from 'express';
import {
  getResetPasswordPage,
  hasResetPasswordErrors,
  validateResetPassword,
} from '../services/resetPasswordService';

const router = Router();

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

router.get('/', (req: Request, res: Response) => {
  const email = asString(req.query.email);
  res.render('forget_password/reset_password', getResetPasswordPage(email));
});

router.post('/', (req: Request, res: Response) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const email = asString(body.email);
  const errors = validateResetPassword(
    asString(body.newPassword),
    asString(body.confirmPassword),
  );

  if (hasResetPasswordErrors(errors)) {
    res
      .status(400)
      .render(
        'forget_password/reset_password',
        getResetPasswordPage(email, errors),
      );
    return;
  }

  res.render('forget_password/reset_password', {
    ...getResetPasswordPage(email),
    message: 'Your new password is valid. Saving it is not connected yet.',
  });
});

export default router;
