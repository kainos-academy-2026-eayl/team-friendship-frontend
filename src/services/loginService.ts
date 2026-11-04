import loginPage from '../views/pages/login/login_page';
import {
  applyPasswordState,
  emptyPasswordState,
  type PasswordState,
} from './passwordVisibilityService';
import { parseSessionTokens, type SessionTokens } from './sessionService';

export type LoginCredentials = Record<string, string>;

export type LoginResult =
  | { ok: true; message: string; tokens: SessionTokens; isAdmin: boolean }
  | { ok: false; message: string };

interface LoginResponseBody {
  customer?: { role?: string };
  message?: string;
  error?: string;
  details?: Record<string, string[]>;
}

export async function login(
  apiUrl: string,
  credentials: LoginCredentials,
): Promise<LoginResult> {
  try {
    const response = await fetch(`${apiUrl}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const body: LoginResponseBody = await response.json().catch(() => ({}));

    if (response.ok) {
      const tokens = parseSessionTokens(body);
      if (!tokens) {
        return { ok: false, message: 'Login failed.' };
      }
      return {
        ok: true,
        message: body.message ?? 'Login successful',
        tokens,
        isAdmin: body.customer?.role === 'admin',
      };
    }

    const fieldErrors = Object.values(body.details ?? {}).flat();
    return {
      ok: false,
      message: fieldErrors[0] ?? body.error ?? 'Login failed.',
    };
  } catch {
    return {
      ok: false,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}

export const loginFieldNames = loginPage.fields.map((field) => field.name);
export const loginPasswordFieldNames = loginPage.fields
  .filter((field) => field.type === 'password')
  .map((field) => field.name);

export function getLoginPage(
  passwordState: PasswordState = emptyPasswordState,
) {
  return {
    ...loginPage,
    fields: applyPasswordState(loginPage.fields, passwordState),
  };
}
