/**
 * FIELD-TRACK-1 — pure helpers for replaying route sessions from the sync queue.
 *
 * Kept free of Dexie and browser globals so the queue's decision logic can be
 * exercised in a plain Node test runner.
 */
import type { FieldSampleUpload } from '@/lib/api/field-session.service';
import type { FieldSession, FieldSessionSample } from '@/lib/db/database';

/** Samples per HTTP request; the server accepts up to 500. */
export const FIELD_SAMPLE_BATCH_SIZE = 200;

/** Batches per queue run, so a large backlog cannot monopolise the worker. */
export const MAX_SAMPLE_BATCHES_PER_RUN = 5;

/**
 * Relative order in which queue operations must be attempted.
 *
 * Responses come first because they are what the campaign actually needs; the
 * session upsert must precede its samples, since the server rejects samples
 * for a session it has never seen.
 */
export function operationRank(operationType: string): number {
  switch (operationType) {
    case 'CREATE_RESPONSE':
      return 0;
    case 'UPLOAD_FILE':
      return 1;
    case 'CONFIRM_DOCUMENT':
      return 2;
    case 'UPSERT_FIELD_SESSION':
      return 3;
    case 'UPLOAD_FIELD_SESSION_SAMPLES':
      return 4;
    default:
      return 9;
  }
}

/**
 * Why a sample upload cannot proceed right now.
 *
 * `not_synced` is transient by construction: the session upsert sits ahead of
 * the samples in the same queue.
 */
export type FieldSampleReadiness = 'ready' | 'session_missing' | 'not_synced';

export function classifySampleReadiness(
  session: Pick<FieldSession, 'server_id'> | null | undefined
): FieldSampleReadiness {
  if (!session) return 'session_missing';
  if (session.server_id == null) return 'not_synced';
  return 'ready';
}

/** A malformed config must not block the session from reaching the server. */
export function parseSessionConfig(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Translate a Dexie row into the wire payload the API expects. */
export function toSampleUpload(sample: FieldSessionSample): FieldSampleUpload {
  return {
    sample_seq: sample.sample_seq,
    sample_type: sample.sample_type,
    recorded_at: sample.recorded_at,
    latitude: sample.latitude ?? null,
    longitude: sample.longitude ?? null,
    accuracy_m: sample.accuracy_m ?? null,
    altitude_m: sample.altitude_m ?? null,
    speed_mps: sample.speed_mps ?? null,
    heading_deg: sample.heading_deg ?? null,
    provider: sample.provider ?? null,
    app_state: sample.app_state ?? null,
    is_mocked: Boolean(sample.is_mocked),
    battery_pct: sample.battery_pct ?? null,
    media_file_id: sample.media_file_id ?? null,
    payload: parseSamplePayload(sample.payload_json),
  };
}

function parseSamplePayload(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // A corrupt payload is metadata, not the position — send the fix anyway.
    return null;
  }
}