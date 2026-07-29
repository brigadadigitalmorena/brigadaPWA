/**
 * Per-error-code diagnostic copy (Q-OP-3 + UX-OP-7)
 *
 * Maps `sync_queue.last_error_code` (set by `markAsFailed()` and friends)
 * to a user-facing title + recommended action. Single source of truth
 * used by:
 *   - dead-letter banner (per-item rows + bulk header)
 *   - PendingDetailSheet (UX-OP-1)
 *   - SchemaMismatchBanner (UX-OP-4) via the `schema_mismatch` key
 *   - any future toast surface
 *
 * Keep keys lowercase; matching is case-insensitive.
 */

export interface SyncErrorCopy {
  /** Short noun phrase shown above the error message. */
  title: string;
  /**
   * Optional one-line context body. When omitted, surfaces fall back to
   * `action` (which has historically played both roles).
   */
  body?: string;
  /** One-sentence recommended action shown below the error message. */
  action: string;
  /** True when retrying without changes will likely fail again. */
  needsManualFix: boolean;
}

const FALLBACK: SyncErrorCopy = {
  title: "Error desconocido",
  body: "No pudimos identificar la causa exacta del problema.",
  action: "Revisa tu conexión y vuelve a intentar.",
  needsManualFix: false,
};

const TABLE: Record<string, SyncErrorCopy> = {
  // ── Network / transport ──────────────────────────────────────────────
  network_offline: {
    title: "Sin conexión",
    action: "El envío se reintentará cuando recuperes señal.",
    needsManualFix: false,
  },
  network_timeout: {
    title: "Tiempo de espera agotado",
    action:
      "La red está lenta. El envío se reintentará automáticamente más tarde.",
    needsManualFix: false,
  },
  request_timeout: {
    title: "Tiempo de espera agotado",
    action:
      "La red está lenta. El envío se reintentará automáticamente más tarde.",
    needsManualFix: false,
  },

  // ── Auth ─────────────────────────────────────────────────────────────
  auth_expired: {
    title: "Sesión expirada",
    action: "Inicia sesión de nuevo para continuar.",
    needsManualFix: true,
  },
  unauthorized: {
    title: "Sesión expirada",
    action: "Inicia sesión de nuevo para continuar.",
    needsManualFix: true,
  },
  forbidden: {
    title: "Sin permiso",
    action: "Ya no tienes acceso a esta encuesta. Contacta a tu coordinador.",
    needsManualFix: true,
  },

  // ── Schema / version mismatch ────────────────────────────────────────
  schema_mismatch: {
    title: "Esta encuesta cambió",
    body: "La versión más reciente se descargará automáticamente.",
    action:
      "Recarga las encuestas asignadas para descargar la versión vigente.",
    needsManualFix: true,
  },
  survey_archived: {
    title: "Versión archivada",
    action:
      "Esta versión ya no está disponible. Termina el borrador y empieza uno nuevo.",
    needsManualFix: true,
  },
  survey_unpublished: {
    title: "Encuesta despublicada",
    action: "El coordinador retiró esta encuesta. No se enviará.",
    needsManualFix: true,
  },

  // ── Validation / payload ─────────────────────────────────────────────
  validation_error: {
    title: "Datos inválidos",
    action:
      "Toca Corregir respuesta para volver a la encuesta y ajustar el dato marcado.",
    needsManualFix: true,
  },
  other_failed_rejection: {
    title: "Respuesta rechazada",
    action:
      "Toca Corregir respuesta para revisar la encuesta antes de reintentar.",
    needsManualFix: true,
  },
  invalid_payload: {
    title: "Datos inválidos",
    action: "Abre el borrador y revisa las respuestas marcadas en rojo.",
    needsManualFix: true,
  },
  duplicate_response: {
    title: "Ya enviado",
    action: "Esta respuesta ya estaba registrada en el servidor.",
    needsManualFix: false,
  },

  // ── Files / uploads ──────────────────────────────────────────────────
  file_too_large: {
    title: "Archivo muy grande",
    action:
      "Vuelve a tomar la foto con menor resolución desde la cámara de la app.",
    needsManualFix: true,
  },
  presigned_expired: {
    title: "URL de carga expirada",
    action: "El envío se reintentará con un enlace nuevo.",
    needsManualFix: false,
  },
  upload_failed: {
    title: "Falla al subir archivo",
    action: "El envío se reintentará automáticamente.",
    needsManualFix: false,
  },

  // ── Server ───────────────────────────────────────────────────────────
  server_error: {
    title: "Error del servidor",
    action:
      "El servidor falló. El envío se reintentará automáticamente más tarde.",
    needsManualFix: false,
  },
  rate_limited: {
    title: "Demasiados envíos",
    action:
      "El servidor pidió esperar. El envío se reintentará automáticamente.",
    needsManualFix: false,
  },

  // ── Local DB ─────────────────────────────────────────────────────────
  corrupt_answers_json: {
    title: "Borrador dañado",
    action: "Usa “Recuperar desde historial” en la pantalla de borradores.",
    needsManualFix: true,
  },
  network_failure: {
    title: "Error de red",
    action: "Revisa tu conexión e intenta de nuevo.",
    needsManualFix: false,
  },
  sync_error: {
    title: "Error al sincronizar",
    action: "Reintenta el envío. Si persiste, revisa el detalle del error.",
    needsManualFix: false,
  },
  auth_required: {
    title: "Sesión expirada",
    action: "Inicia sesión de nuevo y luego sincroniza.",
    needsManualFix: true,
  },
  blob_missing: {
    title: "Archivo no encontrado",
    body: "La foto o firma ya no está en este dispositivo.",
    action: "Vuelve a capturar el archivo en la encuesta.",
    needsManualFix: true,
  },
  local_file_missing: {
    title: "Archivo local faltante",
    action: "Vuelve a capturar el archivo y finaliza de nuevo.",
    needsManualFix: true,
  },
  server_rejected: {
    title: "Rechazado por el servidor",
    action: "Revisa los datos de la encuesta o contacta soporte.",
    needsManualFix: true,
  },
  batch_rejected: {
    title: "Envío rechazado",
    action: "Revisa el mensaje de error y corrige la encuesta.",
    needsManualFix: true,
  },
  presign_missing: {
    title: "No se pudo preparar la subida",
    action: "Reintenta con buena conexión.",
    needsManualFix: false,
  },
  r2_put_failed: {
    title: "Error al subir archivo",
    action: "Reintenta la sincronización.",
    needsManualFix: false,
  },
};

/**
 * Resolve a user-facing copy bundle for a `last_error_code`.
 * Always returns something safe to render — never throws.
 */
export function getSyncErrorCopy(
  code: string | null | undefined,
): SyncErrorCopy {
  if (!code) return FALLBACK;
  const normalized = code.trim().toLowerCase();
  return TABLE[normalized] ?? FALLBACK;
}

export function isSyncErrorCodeKnown(code: string | null | undefined): boolean {
  if (!code) return false;
  return Object.prototype.hasOwnProperty.call(TABLE, code.trim().toLowerCase());
}
