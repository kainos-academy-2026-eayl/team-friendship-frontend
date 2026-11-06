import { z } from 'zod';

export const adminPeriodSchema = z.enum(['today', 'week', 'month']);
export type AdminPeriod = z.infer<typeof adminPeriodSchema>;

export const adminPeriods = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
] as const;

// Temporary display data until the discount-code backend is merged.
export const demoDiscountCodes = [
  {
    code: 'WELCOME10',
    discount: '10% off',
    status: 'Active',
    expires: '31 December 2026',
  },
  {
    code: 'SAVE5',
    discount: 'GBP 5 off',
    status: 'Active',
    expires: 'No expiry',
  },
  {
    code: 'SUMMER20',
    discount: '20% off',
    status: 'Expired',
    expires: '31 August 2026',
  },
  {
    code: 'VIP15',
    discount: '15% off',
    status: 'Disabled',
    expires: 'No expiry',
  },
] as const;

const stockProductSchema = z.object({
  productID: z.number().int().positive(),
  productName: z.string().min(1),
  productStock: z.number().int().nonnegative(),
});

const dashboardSchema = z.object({
  period: adminPeriodSchema,
  totalOrders: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
  currency: z.literal('GBP'),
  lowStockProducts: z.array(
    stockProductSchema.extend({ productStock: z.number().int().min(0).max(4) }),
  ),
});

type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function adminRequest<T>(
  apiUrl: string,
  path: string,
  accessToken: string,
  schema: z.ZodType<T>,
  method = 'GET',
): Promise<AdminResult<T>> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          status: response.status,
          message:
            'Your session does not have permission to access the admin portal.',
        };
      }
      if (response.status === 404 && method === 'POST') {
        return {
          ok: false,
          status: 404,
          message:
            'The product or stock reorder endpoint could not be found. Stock has not been confirmed as updated.',
        };
      }
      console.error('Admin API request failed', method, path, response.status);
      return {
        ok: false,
        status: 502,
        message: 'The admin service is unavailable. Please try again later.',
      };
    }

    const result = schema.safeParse(await response.json());
    if (!result.success) {
      console.error(
        'Unexpected admin API response',
        path,
        z.flattenError(result.error),
      );
      return {
        ok: false,
        status: 502,
        message:
          'The admin service returned an invalid response. Please try again later.',
      };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    console.error('Unable to complete admin API request', method, path, error);
    return {
      ok: false,
      status: 502,
      message:
        method === 'POST'
          ? 'Could not confirm the stock update. Refresh the dashboard before retrying.'
          : 'Unable to reach the admin service. Please try again later.',
    };
  }
}

export async function getAdminDashboard(
  apiUrl: string,
  accessToken: string,
  period: AdminPeriod,
) {
  const result = await adminRequest(
    apiUrl,
    `/admin/dashboard?period=${period}`,
    accessToken,
    dashboardSchema,
  );
  if (!result.ok) {
    throw new AdminApiError(result.status, result.message);
  }
  if (result.data.period !== period) {
    console.error('Admin API returned the wrong reporting period');
    throw new AdminApiError(
      502,
      'The admin service returned the wrong reporting period.',
    );
  }

  const products = [...result.data.lowStockProducts].sort(
    (a, b) =>
      a.productStock - b.productStock ||
      a.productName.localeCompare(b.productName),
  );
  return {
    totalOrders: result.data.totalOrders.toLocaleString('en-GB'),
    revenue: new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: result.data.currency,
    }).format(result.data.revenue),
    outOfStock: products.filter((product) => product.productStock === 0),
    lowStock: products.filter((product) => product.productStock > 0),
  };
}

export async function reorderStock(
  apiUrl: string,
  accessToken: string,
  productId: number,
) {
  const result = await adminRequest(
    apiUrl,
    `/admin/products/${productId}/reorder`,
    accessToken,
    z.object({ product: stockProductSchema }),
    'POST',
  );
  if (!result.ok) {
    throw new AdminApiError(result.status, result.message);
  }
  if (result.data.product.productID !== productId) {
    console.error('Admin API returned the wrong reordered product');
    throw new AdminApiError(
      502,
      'Could not confirm the stock update. Refresh the dashboard before retrying.',
    );
  }
  return result.data.product;
}
