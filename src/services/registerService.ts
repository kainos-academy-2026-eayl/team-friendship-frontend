export type RegistrationData = Record<string, FormDataEntryValue>;

export interface RegisterResult {
  ok: boolean;
  message: string;
}

interface RegisterResponseBody {
  message?: string;
}

export function passwordsMatch(data: RegistrationData): boolean {
  return data.password === data.confirmPassword;
}

export async function register(
  apiUrl: string,
  data: RegistrationData,
): Promise<RegisterResult> {
  try {
    const response = await fetch(`${apiUrl}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body: RegisterResponseBody = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        ok: true,
        message: body.message ?? 'Account created successfully.',
      };
    }

    return { ok: false, message: body.message ?? 'Registration failed.' };
  } catch {
    return {
      ok: false,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}
