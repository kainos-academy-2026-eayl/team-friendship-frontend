import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  AdminApiError,
  adminPeriodSchema,
  adminPeriods,
  getAdminDashboard,
  reorderStock,
} from '../services/adminService';
import { backendUrl, requireLogin } from './sessionController';

const router = Router();
const page = { title: 'Admin portal' };
const productIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive());

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireLogin);
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!res.locals.isAdmin) {
    res.status(403).render('admin/admin', {
      page,
      error: 'Access denied. An administrator account is required.',
    });
    return;
  }
  next();
});

router.get('/', async (req, res) => {
  const period = adminPeriodSchema.safeParse(req.query.period ?? 'today');
  if (!period.success) {
    res.status(400).render('admin/admin', {
      page,
      periods: adminPeriods,
      period: 'today',
      error: 'Choose Today, This week or This month.',
    });
    return;
  }

  const dashboard = await getAdminDashboard(
    backendUrl(),
    res.locals.accessToken,
    period.data,
  );
  res.render('admin/admin', {
    page,
    dashboard,
    periods: adminPeriods,
    period: period.data,
    periodLabel: adminPeriods.find((option) => option.value === period.data)
      ?.label,
    reordered: req.query.reordered === '1',
  });
});

router.post('/products/:id/reorder', async (req, res) => {
  const productId = productIdSchema.safeParse(req.params.id);
  const period = adminPeriodSchema.safeParse(req.body?.period);
  if (!productId.success || !period.success) {
    res.status(400).render('admin/admin', {
      page,
      error: 'Invalid reorder request. Return to the dashboard and try again.',
    });
    return;
  }

  await reorderStock(backendUrl(), res.locals.accessToken, productId.data);
  res.redirect(303, `/admin?period=${period.data}&reordered=1`);
});

router.use(
  (error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof AdminApiError) {
      res
        .status(error.status)
        .render('admin/admin', { page, error: error.message });
      return;
    }
    console.error('Unexpected admin portal error', error);
    res.status(500).render('admin/admin', {
      page,
      error: 'Unable to load the admin portal. Please try again later.',
    });
  },
);

export default router;
