import type { SessionTokens } from '../services/sessionService';

export type LoginCredentials = Record<string, string>;

export type LoginResult =
  | { ok: true; message: string; tokens: SessionTokens; isAdmin: boolean }
  | { ok: false; message: string };

export interface LoginResponseBody {
  customer?: { role?: string };
  message?: string;
  error?: string;
  details?: Record<string, string[]>;
}
