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

// Roles must come from the backend, never from form fields or unsigned cookies.
export async function getSessionUser(
  apiUrl: string,
  accessToken: string,
): Promise<{ isAdmin: boolean; customerId: number | undefined; } | null> {
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
    isAdmin:
      typeof body === 'object' &&
      body !== null &&
      'role' in body &&
      body.role === 'admin',
    customerId:
      typeof body === 'object' &&
        body !== null &&
        'customerId' in body &&
        typeof body.customerId === 'number'
        ? body.customerId
        : undefined,
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
