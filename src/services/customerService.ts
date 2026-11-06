import { z } from 'zod';
import type { DeliveryAddress } from '../models/orderModel';

const addressResponseSchema = z.object({
  address: z.object({ address: z.string(), postcode: z.string() }),
});

export type HomeAddressResult =
  | { ok: true; address: DeliveryAddress }
  | { ok: false; status: number; message: string };

export async function getHomeAddress(
  apiUrl: string,
  accessToken: string,
): Promise<HomeAddressResult> {
  const fallback = 'Unable to load your home address.';
  try {
    const response = await fetch(`${apiUrl}/customers/me/address`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { ok: false, status: response.status, message: fallback };
    }

    const result = addressResponseSchema.safeParse(await response.json());
    if (!result.success) {
      console.error(
        'Unexpected address response',
        z.flattenError(result.error),
      );
      return { ok: false, status: 502, message: fallback };
    }
    return { ok: true, address: result.data.address };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}
