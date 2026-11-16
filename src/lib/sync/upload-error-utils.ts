export type UploadErrorCode =
  | "DNS_RESOLUTION_FAILED"
  | "R2_PUT_TIMEOUT"
  | "R2_PUT_TRANSIENT"
  | "R2_CORS_OR_NETWORK"
  | "R2_403_EXPIRED"
  | "R2_403_PERMISSION"
  | "R2_RATE_LIMITED"
  | "R2_PUT_FAILED";

const UPLOAD_ERROR_COPY: Record<UploadErrorCode, string> = {
  DNS_RESOLUTION_FAILED:
    "No se pudo resolver el almacenamiento de archivos. Revisa la red e intenta de nuevo.",
  R2_PUT_TIMEOUT:
    "La subida del archivo tardó demasiado. El envío sigue pendiente y se reintentará.",
  R2_PUT_TRANSIENT:
    "No se pudo conectar al almacenamiento de archivos. Se reintentará automáticamente.",
  R2_CORS_OR_NETWORK:
    "No se pudo subir el archivo (bloqueo de red o CORS en el almacenamiento). Revisa la conexión o la configuración de R2 e intenta de nuevo.",
  R2_403_EXPIRED:
    "El enlace de subida expiró. Se pedirá uno nuevo en el próximo intento.",
  R2_403_PERMISSION:
    "El almacenamiento rechazó el archivo. Contacta a soporte si persiste.",
  R2_RATE_LIMITED:
    "Demasiadas subidas seguidas. El envío se reintentará automáticamente.",
  R2_PUT_FAILED: "No se pudo subir el archivo. Reintenta la sincronización.",
};

export function uploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : error ? String(error) : "";
}

export function classifyUploadError(error: unknown): UploadErrorCode {
  const message = uploadErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("unable to resolve host") ||
    normalized.includes("no address associated with hostname") ||
    normalized.includes("eai_again") ||
    normalized.includes("enotfound") ||
    normalized.includes("dns")
  ) {
    return "DNS_RESOLUTION_FAILED";
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("tardó demasiado") ||
    normalized.includes("aborted")
  ) {
    return "R2_PUT_TIMEOUT";
  }

  if (
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit") ||
    normalized.includes("rate_limit") ||
    normalized.includes("ratelimit")
  ) {
    return "R2_RATE_LIMITED";
  }

  if (normalized.includes("403")) {
    // Distinguish expired presigned URL (retryable with fresh params)
    // from permission/policy errors (not retryable).
    if (
      normalized.includes("expired") ||
      normalized.includes("presign") ||
      normalized.includes("request has expired") ||
      normalized.includes("x-amz-expired")
    ) {
      return "R2_403_EXPIRED";
    }
    // All other 403s are permission errors (bucket policy, wrong creds, etc.)
    return "R2_403_PERMISSION";
  }

  // Browser TypeError when CORS blocks the PUT or the host is unreachable —
  // this is the raw string users saw as "Failed to fetch" in Mis envíos.
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("networkerror when attempting to fetch")
  ) {
    return "R2_CORS_OR_NETWORK";
  }

  if (
    normalized.includes("network request failed") ||
    normalized.includes("network error") ||
    normalized.includes("connection reset") ||
    normalized.includes("connection refused") ||
    normalized.includes("socket") ||
    normalized.includes("host unreachable") ||
    normalized.includes("failed to connect")
  ) {
    return "R2_PUT_TRANSIENT";
  }

  return "R2_PUT_FAILED";
}

export function describeUploadError(error: unknown): {
  code: UploadErrorCode;
  message: string;
} {
  const code = classifyUploadError(error);
  return { code, message: UPLOAD_ERROR_COPY[code] };
}

export function isRetryableUploadError(error: unknown): boolean {
  const code = classifyUploadError(error);
  return (
    code === "DNS_RESOLUTION_FAILED" ||
    code === "R2_PUT_TIMEOUT" ||
    code === "R2_PUT_TRANSIENT" ||
    code === "R2_CORS_OR_NETWORK" ||
    code === "R2_RATE_LIMITED" ||
    code === "R2_403_EXPIRED"
  );
}

export function isRateLimitedUploadError(error: unknown): boolean {
  return classifyUploadError(error) === "R2_RATE_LIMITED";
}
