export interface SyncRunResult {
  attempted: number;
  succeeded: number;
  failed: number;
  skippedReason?: 'no_session' | 'busy';
  errors: string[];
}

export interface SyncRunNotice {
  tone: 'success' | 'warning' | 'error';
  message: string;
  /** True when the server accepted at least one item. */
  confirmed: boolean;
}

export function describeSyncRun(result: SyncRunResult): SyncRunNotice {
  if (result.skippedReason === 'no_session') {
    return {
      tone: 'error',
      confirmed: false,
      message: 'No hay sesión activa. Vuelve a entrar para enviar las encuestas.',
    };
  }

  if (result.skippedReason === 'busy') {
    return {
      tone: 'warning',
      confirmed: false,
      message: 'Ya hay un envío en curso. Espera a que termine y vuelve a intentar.',
    };
  }

  if (result.attempted === 0) {
    return {
      tone: 'warning',
      confirmed: false,
      message: 'No había envíos listos para salir. Si siguen pendientes, vuelve a intentar.',
    };
  }

  const detail = result.errors[0];

  if (result.succeeded > 0 && result.failed === 0) {
    const noun = result.succeeded === 1 ? 'elemento' : 'elementos';
    return {
      tone: 'success',
      confirmed: true,
      message: `Se enviaron ${result.succeeded} ${noun}. El servidor los confirmó.`,
    };
  }

  if (result.succeeded > 0) {
    return {
      tone: 'warning',
      confirmed: true,
      message: detail
        ? `Se enviaron ${result.succeeded}. ${result.failed} no se pudieron enviar: ${detail}`
        : `Se enviaron ${result.succeeded}. ${result.failed} no se pudieron enviar.`,
    };
  }

  return {
    tone: 'error',
    confirmed: false,
    message: detail
      ? `No se envió nada. ${detail}`
      : 'No se envió nada. Revisa la conexión e intenta de nuevo.',
  };
}
