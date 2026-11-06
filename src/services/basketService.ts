function backendUrl() {
  return process.env.BACKEND_URL ?? 'http://localhost:3000';
}

export type BasketItem = {
  basketID: number;
  quantity: number;
  product: {
    productName: string;
    productPrice: number;
    productImage: string;
  };
};

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

    const body = await response.json().catch(() => ({}));

    if (response.ok && Array.isArray(body.basket)) {
      return { ok: true, basket: body.basket };
    }

    return {
      ok: false,
      basket: [],
      message: body.error ?? 'Unable to load your basket.',
    };
  } catch {
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

  return await response.json();
}
