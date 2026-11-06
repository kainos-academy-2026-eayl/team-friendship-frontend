import { capitaliseName } from '../utils/name';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresAt: string;
}

export function parseSessionTokens(body: unknown): SessionTokens | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const { accessToken, refreshToken, expiresIn, refreshExpiresAt } =
    body as Record<string, unknown>;
  if (
    typeof accessToken !== 'string' ||
    typeof refreshToken !== 'string' ||
    typeof expiresIn !== 'number' ||
    typeof refreshExpiresAt !== 'string'
  ) {
    return undefined;
  }
  return { accessToken, refreshToken, expiresIn, refreshExpiresAt };
}

// Returns null when the backend rejects the token; throws when the backend can't be reached.
export async function refreshSession(
  apiUrl: string,
  refreshToken: string,
): Promise<SessionTokens | null> {
  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (response.status === 400 || response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Session refresh failed with status ${response.status}`);
  }
  return parseSessionTokens(await response.json()) ?? null;
}

export interface SessionUser {
  isAdmin: boolean;
  // Only customer accounts have one; staff accounts get undefined.
  customerId: number | undefined;
}

function parseCustomerId(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null || !('customerId' in body)) {
    return undefined;
  }
  const { customerId } = body;
  return typeof customerId === 'number' &&
    Number.isInteger(customerId) &&
    customerId > 0
    ? customerId
    : undefined;
}

// Roles and IDs must come from the backend, never from form fields or unsigned cookies.
export async function getSessionUser(
  apiUrl: string,
  accessToken: string,
): Promise<{
  isAdmin: boolean;
  customerId: number | undefined;
  displayName: string | undefined;
} | null> {
  const response = await fetch(`${apiUrl}/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Session check failed with status ${response.status}`);
  }
  const body: unknown = await response.json();
  return {
    displayName:
      typeof body === 'object' &&
      body !== null &&
      'firstName' in body &&
      typeof body.firstName === 'string' &&
      'surname' in body &&
      typeof body.surname === 'string'
        ? `${capitaliseName(body.firstName)} ${capitaliseName(body.surname)}`.trim() ||
          undefined
        : undefined,
    isAdmin:
      typeof body === 'object' &&
      body !== null &&
      'role' in body &&
      body.role === 'admin',
    customerId: parseCustomerId(body),
  };
}

export async function endSession(
  apiUrl: string,
  refreshToken: string,
): Promise<void> {
  await fetch(`${apiUrl}/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}
