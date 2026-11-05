import { type Request, type Response, Router } from 'express';
import { type BasketItem, getCheckoutBasket } from '../services/basketService';
import { getHomeAddress } from '../services/customerService';
import checkoutPage from '../views/pages/checkout/checkout';
import { backendUrl } from './sessionController';

const router = Router();

function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

function checkoutSummary(items: BasketItem[]) {
  const total = items.reduce(
    (sum, item) => sum + item.product.productPrice * item.quantity,
    0,
  );
  return {
    lines: items.map((item) => ({
      name: item.product.productName,
      quantity: item.quantity,
      lineTotal: formatPrice(item.product.productPrice * item.quantity),
    })),
    total: formatPrice(total),
  };
}

router.get('/', async (req: Request, res: Response) => {
  const customerID: number | undefined = res.locals.customerId;
  if (!customerID) {
    res.status(502).render('checkout/checkout', {
      page: checkoutPage,
      error: 'Unable to load your basket.',
    });
    return;
  }

  const [result, homeAddress] = await Promise.all([
    getCheckoutBasket(backendUrl(), res.locals.accessToken, customerID),
    getHomeAddress(backendUrl(), res.locals.accessToken),
  ]);

  if (
    (!result.ok && result.status === 401) ||
    (!homeAddress.ok && homeAddress.status === 401)
  ) {
    res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  if (!result.ok) {
    res.status(502).render('checkout/checkout', {
      page: checkoutPage,
      error: result.message,
    });
    return;
  }

  res.render('checkout/checkout', {
    page: checkoutPage,
    summary: checkoutSummary(result.items),
    homeAddress: homeAddress.ok ? homeAddress.address : undefined,
    homeAddressError: homeAddress.ok ? undefined : homeAddress.message,
  });
});

export default router;
