import apiClient from './client';
import type {
  CompleteActivationPayload,
  CompleteActivationResult,
  ResendActivationCodeResult,
  ValidateActivationCodeResult,
} from '@/lib/utils/activation-messages';

function extractApiMessage(error: unknown, fallback: string): string {
  const statusCode =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

  if (statusCode === 429) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  }

  const responseData =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error as { response?: { data?: { detail?: unknown } } }).response?.data
      : undefined;

  const detail = responseData?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) =>
        typeof entry === 'object' && entry !== null && 'msg' in entry
          ? String((entry as { msg?: string }).msg ?? '')
          : ''
      )
      .filter(Boolean);
    if (messages.length > 0) return messages.join(', ');
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }

  return fallback;
}

export async function validateActivationCode(
  code: string,
  identifier?: string
): Promise<ValidateActivationCodeResult> {
  try {
    const response = await apiClient.post<ValidateActivationCodeResult>(
      '/public/activate/validate-code',
      { code, ...(identifier ? { identifier } : {}) }
    );
    return response.data;
  } catch (error: unknown) {
    return {
      valid: false,
      error: extractApiMessage(error, 'No se pudo validar el código'),
    };
  }
}

export async function resendActivationCode(
  code: string,
  identifier?: string
): Promise<ResendActivationCodeResult> {
  try {
    const response = await apiClient.post<ResendActivationCodeResult>(
      '/public/activate/resend-code',
      { code, ...(identifier ? { identifier } : {}) }
    );
    return response.data;
  } catch (error: unknown) {
    return {
      success: false,
      resent: false,
      error: extractApiMessage(error, 'No se pudo reenviar el código'),
    };
  }
}

export async function completeActivation(
  payload: CompleteActivationPayload
): Promise<CompleteActivationResult> {
  try {
    const response = await apiClient.post<CompleteActivationResult>(
      '/public/activate/complete',
      payload
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractApiMessage(error, 'Error al completar la activación'));
  }
}
