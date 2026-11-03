import type { CookieOptions, NextFunction, Request, Response } from 'express';
import {
  refreshSession,
  type SessionTokens,
  verifyAccessToken,
} from '../services/sessionService';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export function backendUrl(): string {
  return process.env.BACKEND_URL ?? 'http://localhost:3000';
}

export function setSessionCookies(res: Response, tokens: SessionTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookie,
    maxAge: tokens.expiresIn * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    expires: new Date(tokens.refreshExpiresAt),
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookie);
  res.clearCookie(REFRESH_COOKIE, baseCookie);
}

// Parallel requests would otherwise reuse the same refresh token and trip the backend's reuse detection.
const inFlightRefreshes = new Map<string, Promise<SessionTokens | null>>();
const REFRESH_GRACE_MS = 30_000;

function refreshOnce(refreshToken: string): Promise<SessionTokens | null> {
  let pending = inFlightRefreshes.get(refreshToken);
  if (!pending) {
    pending = refreshSession(backendUrl(), refreshToken);
    inFlightRefreshes.set(refreshToken, pending);
    pending.catch(() => inFlightRefreshes.delete(refreshToken));
    setTimeout(
      () => inFlightRefreshes.delete(refreshToken),
      REFRESH_GRACE_MS,
    ).unref();
  }
  return pending;
}

function cookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function loadSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let accessToken = cookie(req, ACCESS_COOKIE);
  const refreshToken = cookie(req, REFRESH_COOKIE);
  let isLoggedIn = false;

  try {
    if (accessToken) {
      isLoggedIn = await verifyAccessToken(backendUrl(), accessToken);
    }
    if (!isLoggedIn && refreshToken) {
      const tokens = await refreshOnce(refreshToken);
      if (tokens) {
        setSessionCookies(res, tokens);
        accessToken = tokens.accessToken;
        isLoggedIn = true;
      } else {
        clearSessionCookies(res);
      }
    } else if (!isLoggedIn && accessToken) {
      res.clearCookie(ACCESS_COOKIE, baseCookie);
    }
  } catch {
    // Backend unreachable: treat this request as logged out but keep the cookies for a retry.
  }

  res.locals.accessToken = isLoggedIn ? accessToken : undefined;
  res.locals.isLoggedIn = isLoggedIn;
  next();
}

export function requireLogin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.locals.isLoggedIn) {
    next();
    return;
  }
  res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
}

// Only same-site paths: rejects absolute URLs and protocol-relative ones like //evil.com or /\evil.com.
export function safeReturnTo(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value)
    ? value
    : undefined;
}
