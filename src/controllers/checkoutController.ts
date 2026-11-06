import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import type { OrderItem } from '../models/orderModel';
import { type BasketItem, getBasket } from '../services/basketService';
import { getHomeAddress } from '../services/customerService';
import {
  calculateDiscount,
  type Discount,
  getDiscount,
} from '../services/discountService';
import { createOrder } from '../services/orderService';
import checkoutPage from '../views/pages/checkout/checkout';
import { backendUrl } from './sessionController';

const router = Router();

function orderItems(basket: BasketItem[]): OrderItem[] {
  const quantities = new Map<number, number>();
  for (const item of basket) {
    quantities.set(
      item.productID,
      (quantities.get(item.productID) ?? 0) + item.quantity,
    );
  }
  return [...quantities].map(([productID, quantity]) => ({
    productID,
    quantity,
  }));
}

function requiredText(message: string, maxLength: number) {
  return z
    .string({ error: message })
    .trim()
    .min(1, { error: message })
    .max(maxLength, { error: `Must be ${maxLength} characters or fewer` });
}

function isUnexpired(expiry: string, now = new Date()): boolean {
  const [month, year] = expiry.split('/').map(Number);
  // Cards are valid until the end of their expiry month.
  return new Date(2000 + (year ?? 0), month ?? 0, 1) > now;
}

export const checkoutFormSchema = z
  .object({
    firstName: requiredText('Enter your first name', 50),
    surname: requiredText('Enter your surname', 50),
    deliveryOption: z.enum(['home', 'other'], {
      error: 'Choose a delivery address',
    }),
    address: z.string().trim().optional(),
    postcode: z.string().trim().optional(),
    discountCode: z
      .string()
      .trim()
      .max(50, 'That discount code is not valid')
      .optional(),
    cardNumber: z
      .string({ error: 'Enter a 16-digit card number' })
      .transform((value) => value.replace(/[\s-]/g, ''))
      .pipe(z.string().regex(/^\d{16}$/, 'Enter a 16-digit card number')),
    expiryDate: z
      .string({ error: 'Enter the expiry date as MM/YY' })
      .trim()
      .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Enter the expiry date as MM/YY')
      .refine(isUnexpired, 'This card has expired'),
    cvv: z
      .string({ error: 'Enter the 3-digit CVV' })
      .trim()
      .regex(/^\d{3}$/, 'Enter the 3-digit CVV'),
  })
  .superRefine((form, ctx) => {
    if (form.deliveryOption !== 'other') return;
    const address = requiredText('Enter your delivery address', 255).safeParse(
      form.address ?? '',
    );
    if (!address.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: address.error.issues[0]?.message ?? 'Invalid address',
      });
    }
    const postcode = requiredText('Enter your postcode', 10).safeParse(
      form.postcode ?? '',
    );
    if (!postcode.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['postcode'],
        message: postcode.error.issues[0]?.message ?? 'Invalid postcode',
      });
    }
  });

type FieldErrors = Partial<Record<string, string>>;

const VALUE_FIELDS = [
  'firstName',
  'surname',
  'deliveryOption',
  'address',
  'postcode',
  'discountCode',
] as const;

// Card details are deliberately excluded so they are never echoed back into the page.
type FormValues = Partial<Record<(typeof VALUE_FIELDS)[number], string>>;

function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

function loadSummary(basket: BasketItem[], discount: Discount | undefined) {
  const lines = [];
  let subtotal = 0;
  for (const item of basket) {
    const lineTotal = item.product.productPrice * item.quantity;
    subtotal += lineTotal;
    lines.push({
      name: item.product.productName,
      quantity: item.quantity,
      lineTotal: formatPrice(lineTotal),
    });
  }

  const discountAmount = discount
    ? calculateDiscount(subtotal, discount.percentOff)
    : 0;
  return {
    lines,
    subtotal: formatPrice(subtotal),
    discount: discount && {
      code: discount.code,
      percentOff: discount.percentOff,
      amount: formatPrice(discountAmount),
    },
    total: formatPrice(subtotal - discountAmount),
  };
}

async function renderCheckout(
  req: Request,
  res: Response,
  status: number,
  form: { values?: FormValues; errors?: FieldErrors; formError?: string } = {},
): Promise<void> {
  const values = form.values ?? {};
  const errors = { ...form.errors };
  const discountCode = values.discountCode?.trim();

  const discountLookup = discountCode
    ? await getDiscount(backendUrl(), res.locals.accessToken, discountCode)
    : undefined;
  if (discountLookup && !discountLookup.ok) {
    errors.discountCode ??= discountLookup.message;
  }
  const discount = discountLookup?.ok ? discountLookup.discount : undefined;

  const [basket, homeAddress] = await Promise.all([
    getBasket(res.locals.accessToken, res.locals.customerId),
    getHomeAddress(backendUrl(), res.locals.accessToken),
  ]);
  const summary = basket.ok ? loadSummary(basket.basket, discount) : undefined;

  if (
    (!homeAddress.ok && homeAddress.status === 401) ||
    (discountLookup?.ok === false && discountLookup.status === 401)
  ) {
    res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  res.status(summary ? status : 502).render('checkout/checkout', {
    page: checkoutPage,
    summary,
    error: basket.ok ? undefined : basket.message,
    homeAddress: homeAddress.ok ? homeAddress.address : undefined,
    homeAddressError: homeAddress.ok ? undefined : homeAddress.message,
    values: discount ? { ...values, discountCode: discount.code } : values,
    errors,
    formError: form.formError,
  });
}

function pickValues(body: Record<string, unknown>): FormValues {
  const values: FormValues = {};
  for (const key of VALUE_FIELDS) {
    const value = body[key];
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}

router.get('/', async (req: Request, res: Response) => {
  await renderCheckout(req, res, 200);
});

router.post('/', async (req: Request, res: Response) => {
  const body: Record<string, unknown> =
    req.body && typeof req.body === 'object' ? req.body : {};
  const values = pickValues(body);
  res.set('Cache-Control', 'no-store');

  if (body.action === 'applyDiscount') {
    const errors: FieldErrors = values.discountCode?.trim()
      ? {}
      : { discountCode: 'Enter a discount code' };
    await renderCheckout(req, res, 200, { values, errors });
    return;
  }

  const parsed = checkoutFormSchema.safeParse(body);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      errors[field] ??= issue.message;
    }
    await renderCheckout(req, res, 400, { values, errors });
    return;
  }

  const customerID: number | undefined = res.locals.customerId;
  if (!customerID) {
    await renderCheckout(req, res, 502, {
      values,
      formError: 'Unable to place your order. Please try again.',
    });
    return;
  }

  const { deliveryOption, address, postcode, discountCode } = parsed.data;
  const basket = await getBasket(res.locals.accessToken, customerID);
  if (!basket.ok || basket.basket.length === 0) {
    await renderCheckout(req, res, basket.ok ? 400 : 502, {
      values,
      formError: basket.ok
        ? 'Your basket is empty. Add products before placing an order.'
        : basket.message,
    });
    return;
  }

  let canonicalCode: string | undefined;
  if (discountCode) {
    const discount = await getDiscount(
      backendUrl(),
      res.locals.accessToken,
      discountCode,
    );
    if (!discount.ok) {
      // renderCheckout repeats the lookup and shows the error beside the discount field.
      await renderCheckout(req, res, discount.status === 404 ? 400 : 502, {
        values,
      });
      return;
    }
    canonicalCode = discount.discount.code;
  }

  const result = await createOrder(
    backendUrl(),
    res.locals.accessToken,
    customerID,
    orderItems(basket.basket),
    {
      ...(deliveryOption === 'other' && address && postcode
        ? { deliveryAddress: { address, postcode } }
        : {}),
      ...(canonicalCode ? { discountCode: canonicalCode } : {}),
    },
  );

  if (!result.ok) {
    if (result.status === 401) {
      res.redirect(`/login?returnTo=${encodeURIComponent('/checkout')}`);
      return;
    }
    await renderCheckout(req, res, result.status === 409 ? 409 : 502, {
      values,
      formError: result.message,
    });
    return;
  }

  res.redirect(303, `/order_confirmation/${result.order.orderID}`);
});

export default router;
