export type UploadErrorCode =
  | "DNS_RESOLUTION_FAILED"
  | "R2_PUT_TIMEOUT"
  | "R2_PUT_TRANSIENT"
  | "R2_403_EXPIRED"
  | "R2_403_PERMISSION"
  | "R2_RATE_LIMITED"
  | "R2_PUT_FAILED";

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

  if (
    normalized.includes("network request failed") ||
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

export function isRetryableUploadError(error: unknown): boolean {
  const code = classifyUploadError(error);
  return (
    code === "DNS_RESOLUTION_FAILED" ||
    code === "R2_PUT_TIMEOUT" ||
    code === "R2_PUT_TRANSIENT" ||
    code === "R2_RATE_LIMITED" ||
    code === "R2_403_EXPIRED"
  );
}

export function isRateLimitedUploadError(error: unknown): boolean {
  return classifyUploadError(error) === "R2_RATE_LIMITED";
}
