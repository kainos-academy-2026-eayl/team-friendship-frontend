import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import type { OrderItem } from '../models/orderModel';
import { getHomeAddress } from '../services/customerService';
import { createOrder } from '../services/orderService';
import { getProducts } from '../services/productService';
import checkoutPage from '../views/pages/checkout/checkout';
import { backendUrl } from './sessionController';

const router = Router();

// Dummy order lines until checkout reads from the basket; IDs must exist in the seeded Product table.
export const DUMMY_ORDER_ITEMS: OrderItem[] = [
  { productID: 4, quantity: 1 },
  { productID: 12, quantity: 2 },
];

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

// Card details are deliberately excluded so they are never echoed back into the page.
type FormValues = Partial<
  Record<
    'firstName' | 'surname' | 'deliveryOption' | 'address' | 'postcode',
    string
  >
>;

function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

async function loadSummary() {
  const result = await getProducts(backendUrl());
  if (!result.ok) return undefined;

  const lines = [];
  let total = 0;
  for (const item of DUMMY_ORDER_ITEMS) {
    const product = result.products.find((p) => p.id === item.productID);
    if (!product) return undefined;
    const lineTotal = Number(product.price) * item.quantity;
    total += lineTotal;
    lines.push({
      name: product.name,
      quantity: item.quantity,
      lineTotal: formatPrice(lineTotal),
    });
  }
  return { lines, total: formatPrice(total) };
}

async function renderCheckout(
  req: Request,
  res: Response,
  status: number,
  form: { values?: FormValues; errors?: FieldErrors; formError?: string } = {},
): Promise<void> {
  const [summary, homeAddress] = await Promise.all([
    loadSummary(),
    getHomeAddress(backendUrl(), res.locals.accessToken),
  ]);

  if (!homeAddress.ok && homeAddress.status === 401) {
    res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  res.status(summary ? status : 502).render('checkout/checkout', {
    page: checkoutPage,
    summary,
    error: summary ? undefined : 'Unable to load your order summary.',
    homeAddress: homeAddress.ok ? homeAddress.address : undefined,
    homeAddressError: homeAddress.ok ? undefined : homeAddress.message,
    values: form.values ?? {},
    errors: form.errors ?? {},
    formError: form.formError,
  });
}

function pickValues(body: Record<string, unknown>): FormValues {
  const values: FormValues = {};
  for (const key of [
    'firstName',
    'surname',
    'deliveryOption',
    'address',
    'postcode',
  ] as const) {
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

  const { deliveryOption, address, postcode } = parsed.data;
  const result = await createOrder(
    backendUrl(),
    res.locals.accessToken,
    customerID,
    DUMMY_ORDER_ITEMS,
    deliveryOption === 'other' && address && postcode
      ? { address, postcode }
      : undefined,
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

  res.redirect(303, `/order_history?placed=${result.order.orderID}`);
});

export default router;
