export type ActivationErrorCode =
  | 'invalid_code'
  | 'expired'
  | 'locked'
  | 'already_used'
  | 'revoked'
  | 'identifier_mismatch'
  | string;

export interface ValidateActivationCodeResult {
  valid: boolean;
  whitelist_entry?: {
    full_name: string;
    assigned_role?: string | null;
    identifier_type: string;
    supervisor_name?: string;
  };
  expires_at?: string;
  remaining_hours?: number;
  error_code?: ActivationErrorCode;
  error?: string;
  resend_available?: boolean;
}

export interface ResendActivationCodeResult {
  success: boolean;
  resent: boolean;
  message?: string;
  expires_at?: string;
  error?: string;
}

export interface CompleteActivationPayload {
  code: string;
  password: string;
  password_confirm: string;
  phone?: string;
  agree_to_terms: boolean;
}

export interface CompleteActivationResult {
  success: boolean;
  status: string;
  message: string;
  email_hint: string;
}

export type StatusVariant = 'success' | 'warning' | 'neutral' | 'error';

export interface ActivationStatusConfig {
  title: string;
  description: string;
  variant: StatusVariant;
}

export const ACTIVATION_STATUS_VARIANT_CLASSES: Record<StatusVariant, string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300',
  neutral: 'border-border bg-muted text-muted-foreground',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
};

export function getActivationStatusConfig(
  result: ValidateActivationCodeResult | null
): ActivationStatusConfig | null {
  if (!result) return null;

  if (result.valid) {
    return {
      title: 'Código válido',
      description: 'Ahora completa tus datos para activar la cuenta.',
      variant: 'success',
    };
  }

  const errorCode = result.error_code;

  if (errorCode === 'identifier_mismatch') {
    return {
      title: 'Correo no coincide',
      description:
        'El correo electrónico ingresado no coincide con la invitación. Verifica que sea el correo donde recibiste el código.',
      variant: 'error',
    };
  }

  if (errorCode === 'expired') {
    return {
      title: 'Código expirado',
      description: 'El código de activación expiró. Solicita uno nuevo si está disponible.',
      variant: 'warning',
    };
  }

  if (errorCode === 'locked') {
    return {
      title: 'Código bloqueado',
      description:
        'Este código fue bloqueado por demasiados intentos fallidos. Solicita uno nuevo si está disponible.',
      variant: 'warning',
    };
  }

  if (errorCode === 'already_used') {
    return {
      title: 'Código ya utilizado',
      description: 'Este código ya fue usado. Si ya activaste tu cuenta, inicia sesión.',
      variant: 'neutral',
    };
  }

  return {
    title: 'Código inválido',
    description: result.error || 'El código no es válido o no fue encontrado.',
    variant: 'error',
  };
}
