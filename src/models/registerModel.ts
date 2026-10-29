export type RegistrationData = Record<string, string>;

export interface RegisterResult {
  ok: boolean;
  message: string;
}

export interface RegisterResponseBody {
  message?: string;
}
