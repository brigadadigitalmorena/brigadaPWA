/**
 * Sync timeout constants (S-OP-8)
 *
 * Centralised home for the per-request timeouts used by the sync engine.
 * Previously these were inlined as magic numbers (`22_000`, `8_000`) which
 * made it impossible to answer "why is this 22 s and not 25 s?" without
 * reading every call site.
 *
 * Rationale per value:
 *
 * - `SUBMIT_RESPONSE_MS` (8 s): online submit is only the fast path. If
 *   the API does not answer quickly, we commit locally and let the queue
 *   retry in the background instead of keeping the brigadista waiting.
 *
 * - `QUEUE_BATCH_MS` (12 s): background queue replay should also fail
 *   fast on flaky links. The backend still deduplicates by `client_id`,
 *   so aborting early is safe: the next retry returns `duplicate` if the
 *   server committed before the client saw the response.
 *
 * - `PREFLIGHT_VALIDATE_MS` (3 s): `/mobile/sync/validate` is an optional
 *   optimization before replay. If it is slow, we skip it and submit the
 *   batch directly because the batch endpoint already handles duplicates.
 *
 * - `CROSS_CHECK_PENDING_CONFIRMS_MS` (8 s): the orphan-confirm
 *   cross-check (S-OP-5) runs at the start of every sync cycle, throttled
 *   to ≥5 min. It is best-effort recovery — a longer timeout would just
 *   delay the actual queue drain on flaky links.
 *
 * - `RECONCILE_INVALID_PAYLOAD_MS` (8 s): the corrupted-payload
 *   watchdog (S-OP-3) is also best-effort and runs at most once per
 *   10 min. Same reasoning as the cross-check.
 *
 * - `BACKGROUND_TASK_BUDGET_MS` (25 s): hard ceiling we enforce on the
 *   `expo-background-task` body (X-OP-4). iOS gives us ≤30 s; we leave
 *   a 5 s margin so our wrap-up code (Sentry capture, DB close) has a
 *   chance to run before the OS kills the task.
 *
 * Any new sync-side timeout must live here. Do not inline numeric
 * literals in axios/fetch options.
 */

export const SYNC_TIMEOUTS = {
  /** Single-phase `submitResponse()` axios + AbortController timeout. */
  SUBMIT_RESPONSE_MS: 8_000,
  /** Background queue response batch replay timeout. */
  QUEUE_BATCH_MS: 12_000,
  /** Optional queued client_id preflight validation timeout. */
  PREFLIGHT_VALIDATE_MS: 3_000,
  /** S-OP-5 orphan-confirm cross-check. */
  CROSS_CHECK_PENDING_CONFIRMS_MS: 8_000,
  /** S-OP-3 corrupted-payload watchdog. */
  RECONCILE_INVALID_PAYLOAD_MS: 8_000,
  /** X-OP-4 expo-background-task body ceiling. */
  BACKGROUND_TASK_BUDGET_MS: 25_000,
} as const;

export type SyncTimeoutKey = keyof typeof SYNC_TIMEOUTS;

/**
 * Race a promise against a timer. Resolves with the promise's value or
 * rejects with the configured `Error` once `timeoutMs` elapses. The
 * underlying promise is NOT cancelled — callers that need cancellation
 * must wire their own `AbortController` (axios) or equivalent.
 *
 * Used by X-OP-4 (background task budget) and any future caller that
 * just wants a hard ceiling without integrating with abort signals.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = `operation_exceeded_${timeoutMs}ms`,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
