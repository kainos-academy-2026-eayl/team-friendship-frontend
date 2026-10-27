export interface RecoveryEmailRequest {
  email: string;
}

interface RecoveryEmailResponseBody {
  message?: string;
  error?: string;
}

export interface RecoveryEmailResult {
  success: boolean;
  message: string;
}

export async function sendRecoveryEmail(
  apiUrl: string,
  request: RecoveryEmailRequest,
): Promise<RecoveryEmailResult> {
  try {
    const response = await fetch(`${apiUrl}/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body: RecoveryEmailResponseBody = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        message: body.error ?? 'Could not send the recovery email.',
      };
    }

    return {
      success: true,
      message: body.message ?? 'Recovery email request sent.',
    };
  } catch {
    return {
      success: false,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}
