import { z } from 'zod';
import { customerDetailsSchema } from '../models/customerDetailsModel';

export async function getCustomerDetails(
  apiUrl: string,
  token: string,
  customerId: number,
) {
  try {
    const response = await fetch(`${apiUrl}/customers/me`, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      console.error('Customer details request failed', response.status);
      return {
        ok: false as const,
        status: [401, 403, 404].includes(response.status)
          ? response.status
          : 502,
        message:
          'Unable to load your customer details. Please try again later.',
      };
    }

    const result = z
      .object({ customer: customerDetailsSchema })
      .safeParse(await response.json());
    if (!result.success || result.data.customer.customerID !== customerId) {
      console.error('Invalid or mismatched customer details response');
      return {
        ok: false as const,
        status: 502,
        message: 'Unable to load your customer details.',
      };
    }
    return { ok: true as const, customer: result.data.customer };
  } catch (error) {
    console.error('Unable to reach customer details service', error);
    return {
      ok: false as const,
      status: 502,
      message:
        'Unable to reach the customer details service. Please try again later.',
    };
  }
}

export async function saveCustomerDetails(
  apiUrl: string,
  token: string,
  values: Record<string, string>,
) {
  try {
    const response = await fetch(`${apiUrl}/customers/me`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      console.error('Customer details update failed', response.status);
      const body: unknown = await response.json();
      const error = z.object({ error: z.string() }).safeParse(body);
      return {
        ok: false as const,
        status: [400, 401, 403, 404, 409, 429].includes(response.status)
          ? response.status
          : 502,
        message:
          error.success && response.status < 500
            ? error.data.error
            : 'Unable to save your details. Please try again later.',
      };
    }
    return { ok: true as const };
  } catch (error) {
    console.error('Unable to reach customer details update service', error);
    return {
      ok: false as const,
      status: 502,
      message:
        'Unable to confirm whether your details were saved. Reload your details before trying again.',
    };
  }
}
