/**
 * Generate a UUID v4 using the Web Crypto API when available.
 * Falls back to a timestamp + random string for older environments.
 */
export function generateResponseId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a short unique ID for local file previews.
 */
export function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
