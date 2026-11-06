import { z } from 'zod';

function backendUrl() {
  return process.env.BACKEND_URL ?? 'http://localhost:3000';
}

export type BasketItem = {
  basketID: number;
  productID: number;
  quantity: number;
  product: {
    productName: string;
    productPrice: number;
    productImage: string;
  };
};

const basketSchema = z.object({
  basket: z.array(
    z.object({
      basketID: z.number().int().positive(),
      productID: z.number().int().positive(),
      quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      product: z.object({
        productName: z.string(),
        productPrice: z.number().nonnegative().finite(),
        productImage: z.string(),
      }),
    }),
  ),
});

export type GetBasketResult =
  | { ok: true; basket: BasketItem[] }
  | { ok: false; basket: BasketItem[]; message: string };

export async function getBasket(
  accessToken: string,
  customerId: number,
): Promise<GetBasketResult> {
  try {
    const response = await fetch(`${backendUrl()}/basket/${customerId}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    });

    const body: unknown = await response.json();
    const parsed = basketSchema.safeParse(body);

    if (response.ok && parsed.success) {
      return { ok: true, basket: parsed.data.basket };
    }

    console.error('Unable to load basket', response.status);
    return {
      ok: false,
      basket: [],
      message: 'Unable to load your basket.',
    };
  } catch (error) {
    console.error('Unable to reach basket service', error);
    return {
      ok: false,
      basket: [],
      message: 'Unable to reach the server. Please try again.',
    };
  }
}

export async function addToBasket(
  accessToken: string,
  customerID: number,
  productID: number,
  quantity: number,
) {
  try {
    const response = await fetch(`${backendUrl()}/basket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        customerID,
        productID,
        quantity,
      }),
    });
    if (!response.ok) {
      console.error('Add to basket failed', response.status);
      return {
        ok: false as const,
        status: [400, 401, 403, 404, 409].includes(response.status)
          ? response.status
          : 502,
        message: 'Unable to add this product to your basket. Please try again.',
      };
    }
    return { ok: true as const };
  } catch (error) {
    console.error('Unable to confirm basket update', error);
    return {
      ok: false as const,
      status: 502,
      message:
        'Unable to confirm whether the item was added. Check your basket before trying again.',
    };
  }
}
