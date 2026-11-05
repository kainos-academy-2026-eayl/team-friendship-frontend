export interface OrderHistoryItem {
  orderId: number;
  date: string;
  product: string;
  quantity: number;
  status: string;
}

export interface GetOrderHistoryResult {
  ok: boolean;
  orders: OrderHistoryItem[];
  message?: string;
}

export async function getOrderHistory(
  apiUrl: string,
  accessToken: string,
  customerID: number,
): Promise<GetOrderHistoryResult> {
  try {
    const response = await fetch(`${apiUrl}/order-history/${customerID}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        ok: true,
        orders: body.orders ?? [],
      };
    }

    return {
      ok: false,
      orders: [],
      message: body.error ?? 'Unable to load order history.',
    };
  } catch {
    return {
      ok: false,
      orders: [],
      message: 'Unable to reach the server. Please try again.',
    };
  }
}
