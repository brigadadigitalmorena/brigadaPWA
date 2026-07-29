/**
 * Exponential backoff with jitter (mobile parity).
 * delaySec = min(2^retry_count * 30 + random(0, 0.5 * base), 1800)
 */
export function calculateRetryBackoffMs(retryCount: number): number {
  const baseDelaySec = Math.pow(2, retryCount) * 30;
  const jitter = Math.random() * baseDelaySec * 0.5;
  const nextRetryDelaySec = Math.min(baseDelaySec + jitter, 1800);
  return Math.round(nextRetryDelaySec * 1000);
}

export function nextRetryAtIso(retryCount: number, now = Date.now()): string {
  return new Date(now + calculateRetryBackoffMs(retryCount)).toISOString();
}
