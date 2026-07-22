import { isAxiosError } from 'axios';

interface ApiErrorBody {
  code?: string;
  message?: string;
  detail?: string | { code?: string; message?: string };
}

function readApiErrorBody(error: unknown): ApiErrorBody | null {
  if (!isAxiosError(error)) return null;
  const data = error.response?.data;
  if (!data || typeof data !== 'object') return null;
  return data as ApiErrorBody;
}

export function getApiErrorCode(error: unknown): string | undefined {
  const body = readApiErrorBody(error);
  if (!body) return undefined;

  if (typeof body.code === 'string') return body.code;

  if (body.detail && typeof body.detail === 'object' && body.detail.code) {
    return body.detail.code;
  }

  return undefined;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error. Intenta de nuevo.'
): string {
  const body = readApiErrorBody(error);
  if (!body) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  if (typeof body.message === 'string' && body.message.length > 0) {
    return body.message;
  }

  if (typeof body.detail === 'string' && body.detail.length > 0) {
    return body.detail;
  }

  if (body.detail && typeof body.detail === 'object' && body.detail.message) {
    return body.detail.message;
  }

  return fallback;
}

export function getLoginErrorMessage(error: unknown): string {
  const code = getApiErrorCode(error);

  if (code === 'email_not_verified') {
    return (
      getApiErrorMessage(error) ||
      'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada y la carpeta de spam.'
    );
  }

  if (isAxiosError(error) && error.response?.status === 401) {
    return 'Credenciales incorrectas. Por favor, intenta de nuevo.';
  }

  return getApiErrorMessage(error, 'Credenciales incorrectas. Por favor, intenta de nuevo.');
}

export function isEmailNotVerifiedError(error: unknown): boolean {
  return getApiErrorCode(error) === 'email_not_verified';
}
