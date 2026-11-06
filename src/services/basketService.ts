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
    productStock: number;
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
        productStock: z.number().int().nonnegative(),
      }),
    }),
  ),
});

export type GetBasketResult =
  | { ok: true; basket: BasketItem[] }
  | { ok: false; basket: BasketItem[]; message: string };

export function quantityInBasket(
  basket: BasketItem[],
  productID: number,
): number {
  return basket
    .filter((item) => item.productID === productID)
    .reduce((total, item) => total + item.quantity, 0);
}

async function basketFailure(response: Response) {
  console.error('Basket update failed', response.status);
  const body: unknown = await response.json();
  const parsed = z.object({ error: z.string() }).safeParse(body);
  return {
    ok: false as const,
    status: [400, 401, 403, 404, 409].includes(response.status)
      ? response.status
      : 502,
    message:
      response.status < 500 && parsed.success
        ? parsed.data.error
        : 'Unable to update your basket. Please try again.',
  };
}

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
      return await basketFailure(response);
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

export async function changeBasketQuantity(
  accessToken: string,
  basketID: number,
  change: -1 | 1,
) {
  try {
    const response = await fetch(`${backendUrl()}/basket/${basketID}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ change }),
    });
    if (!response.ok) return await basketFailure(response);
    return { ok: true as const };
  } catch (error) {
    console.error('Unable to confirm basket quantity update', error);
    return {
      ok: false as const,
      status: 502,
      message:
        'Unable to confirm the quantity update. Reload your basket before trying again.',
    };
  }
}

export async function removeBasketItem(accessToken: string, basketID: number) {
  try {
    const response = await fetch(`${backendUrl()}/basket/${basketID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return await basketFailure(response);
    return { ok: true as const };
  } catch (error) {
    console.error('Unable to confirm basket item removal', error);
    return {
      ok: false as const,
      status: 502,
      message:
        'Unable to confirm whether the item was removed. Reload your basket before trying again.',
    };
  }
}
