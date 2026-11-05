import { z } from 'zod';

const discountResponseSchema = z.object({
  discount: z.object({
    code: z.string(),
    percentOff: z.number().positive().max(100),
  }),
});

export type Discount = z.infer<typeof discountResponseSchema>['discount'];

export type DiscountResult =
  | { ok: true; discount: Discount }
  | { ok: false; status: number; message: string };

export const INVALID_DISCOUNT_MESSAGE = 'That discount code is not valid';

export async function getDiscount(
  apiUrl: string,
  accessToken: string,
  code: string,
): Promise<DiscountResult> {
  try {
    const response = await fetch(
      `${apiUrl}/discounts/${encodeURIComponent(code.trim())}`,
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (response.status === 404) {
      return { ok: false, status: 404, message: INVALID_DISCOUNT_MESSAGE };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: 'Unable to check that discount code. Please try again.',
      };
    }

    const result = discountResponseSchema.safeParse(await response.json());
    if (!result.success) {
      console.error(
        'Unexpected discount response',
        z.flattenError(result.error),
      );
      return {
        ok: false,
        status: 502,
        message: 'Unable to check that discount code. Please try again.',
      };
    }
    return { ok: true, discount: result.data.discount };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}

// Mirrors the backend calculation (whole pence) so the displayed total matches the stored order.
export function calculateDiscount(
  subtotal: number,
  percentOff: number,
): number {
  const subtotalPence = Math.round(subtotal * 100);
  return Math.round((subtotalPence * percentOff) / 100) / 100;
}
