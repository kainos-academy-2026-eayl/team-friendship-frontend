export type RegistrationData = Record<string, FormDataEntryValue>;

export interface RegisterResult {
  ok: boolean;
  message: string;
}

export interface RegisterResponseBody {
  message?: string;
}
