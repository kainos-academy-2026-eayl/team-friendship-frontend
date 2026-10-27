export type LoginCredentials = Record<string, FormDataEntryValue>;

export interface LoginResult {
    ok: boolean;
    message: string;
}

interface LoginResponseBody {
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
            return { ok: true, message: body.message ?? 'Login successful' };
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
