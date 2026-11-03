import { type Request, type Response, Router } from 'express';
import { getResetPasswordPage } from '../services/resetPasswordService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email : '';
  res.render('forget_password/reset_password', getResetPasswordPage(email));
});

export default router;
