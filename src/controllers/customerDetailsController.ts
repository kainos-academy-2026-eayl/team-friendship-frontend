import { Router } from 'express';
import {
  customerEditFieldNames,
  customerEditFields,
} from '../models/customerDetailsModel';
import {
  getCustomerDetails,
  saveCustomerDetails,
} from '../services/customerDetailsService';
import { getPasswordState } from '../services/passwordVisibilityService';
import { backendUrl, requireLogin } from './sessionController';

const router = Router();
const page = { title: 'My details' };
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requireLogin);
router.use((_req, res, next) => {
  if (!res.locals.customerId) {
    res.status(403).render('customer_details/customer_details', {
      page,
      error: 'This page is available to customer accounts only.',
    });
    return;
  }
  next();
});
router.get(['/', '/edit'], async (req, res) => {
  const result = await getCustomerDetails(
    backendUrl(),
    res.locals.accessToken,
    res.locals.customerId,
  );
  if (!result.ok) {
    res.status(result.status).render('customer_details/customer_details', {
      page,
      error: result.message,
    });
    return;
  }
  res.render('customer_details/customer_details', {
    page,
    customer: result.customer,
    editing: req.path === '/edit',
    fields: customerEditFields,
    saved: req.path === '/' && req.query.saved === '1',
  });
});

router.post('/toggle-password', (req, res) => {
  const state = getPasswordState(req.body ?? {}, customerEditFieldNames, [
    'password',
  ]);
  res.render('customer_details/customer_details', {
    page,
    editing: true,
    fields: customerEditFields,
    customer: state.values,
    password: state.values.password,
    passwordVisible: state.visiblePasswords.includes('password'),
  });
});

router.post('/edit', async (req, res) => {
  const state = getPasswordState(req.body ?? {}, customerEditFieldNames, [
    'password',
  ]);
  const result = await saveCustomerDetails(
    backendUrl(),
    res.locals.accessToken,
    state.values,
  );
  if (!result.ok) {
    res.status(result.status).render('customer_details/customer_details', {
      page,
      editing: true,
      fields: customerEditFields,
      customer: state.values,
      error: result.message,
    });
    return;
  }
  res.redirect(303, '/my_details?saved=1');
});
export default router;
