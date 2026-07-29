/**
 * Sync queue priority bands (Q-OP-5)
 *
 * Lower number = processed first by `acquirePendingOperations()`
 * (`ORDER BY priority ASC, created_at ASC`).
 *
 * The bands documented here are the **only** values that should be passed
 * to `syncRepository.addToQueue({ priority })`. Keep this table in sync
 * with `ai-context/walkthroughs/02-queue.md` §"Priority bands".
 */
export const SYNC_PRIORITY = {
  /** Gestión / management surveys — must beat regular responses (M-GESTION-1). */
  GESTION: 0,
  /** Regular survey responses (single-phase + two-phase). */
  RESPONSE: 1,
  /** File uploads (photos, signatures, INE) — heavier, drained after responses. */
  FILE: 2,
  /** Gestión free-text comments — non-critical metadata. */
  GESTION_COMMENT: 3,
  /** Default fallback for operations not explicitly classified. */
  DEFAULT: 5,
} as const;

export type SyncPriority = (typeof SYNC_PRIORITY)[keyof typeof SYNC_PRIORITY];
