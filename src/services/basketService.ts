import { z } from 'zod';

function backendUrl() {
  return process.env.BACKEND_URL ?? 'http://localhost:3000';
}

const basketItemSchema = z.object({
  basketID: z.number().int().positive(),
  productID: z.number().int().positive(),
  quantity: z.number().int().positive(),
  product: z.object({
    productName: z.string(),
    productPrice: z.number().nonnegative(),
  }),
});

const basketResponseSchema = z.object({ basket: z.array(basketItemSchema) });

export type BasketItem = z.infer<typeof basketItemSchema>;

export type BasketResult =
  | { ok: true; items: BasketItem[] }
  | { ok: false; status: number; message: string };

export async function getCheckoutBasket(
  apiUrl: string,
  accessToken: string,
  customerID: number,
): Promise<BasketResult> {
  const fallback = 'Unable to load your basket.';
  try {
    const response = await fetch(
      `${apiUrl}/basket/${encodeURIComponent(customerID)}`,
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return { ok: false, status: response.status, message: fallback };
    }

    const result = basketResponseSchema.safeParse(await response.json());
    if (!result.success) {
      console.error('Unexpected basket response', z.flattenError(result.error));
      return { ok: false, status: 502, message: fallback };
    }
    return { ok: true, items: result.data.basket };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}

export async function getBasket(customerId: number) {
  try {
    const response = await fetch(`${backendUrl()}/basket/${customerId}`, {
      headers: {
        accept: 'application/json',
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Basket fetch error:', error);
    throw error;
  }
}

export async function addToBasket(
  customerID: number,
  productID: number,
  quantity: number,
) {
  const response = await fetch(`${backendUrl()}/basket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      customerID,
      productID,
      quantity,
    }),
  });

  return await response.json();
}
