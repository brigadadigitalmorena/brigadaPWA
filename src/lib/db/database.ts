import Dexie, { Table } from 'dexie';
import { migrateEntitlementCacheKeys } from '@/lib/sync/entitlement-cache-policy';

export interface Survey {
  id?: number;
  survey_id: string;
  version: string;
  title: string;
  description?: string;
  category: string;
  schema_json: string;
  engine_version: number;
  author: string;
  estimated_duration: number;
  tags?: string;
  is_active: boolean;
  is_published: boolean;
  sync_status: 'pending' | 'synced' | 'error';
  last_synced_at?: string;
  remote_updated_at?: string;
  entitlement_json?: string;
  /** @deprecated Read-only during v7 migration from assignment_json */
  assignment_json?: string;
  created_at: string;
  updated_at: string;
}

export interface Response {
  id?: number;
  response_id: string;
  survey_id: string;
  survey_version: string;
  status: 'draft' | 'completed' | 'validated' | 'rejected';
  answers_json: string;
  brigadista_user_id: string;
  brigadista_name: string;
  brigadista_role: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  location_captured_at?: string;
  device_platform: string;
  device_os_version: string;
  device_app_version: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  validation_status: string;
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  sync_attempts: number;
  last_sync_attempt_at?: string;
  last_synced_at?: string;
  sync_error?: string;
  offline_mode: boolean;
  immutable: boolean;
  integrity_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface ResponseAnswer {
  id?: number;
  response_id: string;
  question_id?: number;
  question_key?: string;
  answer_json: string;
  evaluated_label?: string;
  answered_at?: string;
  created_at: string;
}

export interface LocalFile {
  id?: number;
  file_id: string;
  response_id: string;
  file_type: 'photo' | 'signature' | 'ine_front' | 'ine_back' | 'file';
  question_id: string;
  local_path?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key?: string;
  remote_url?: string;
  ine_ocr_data?: string;
  sync_status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploaded_at?: string;
  upload_started_at?: string;
  thumbnail_path?: string;
  document_id?: string;
  presigned_url?: string;
  presigned_expires_at?: string;
  confirmed_at?: string;
  created_at: string;
}

export type SyncQueueStatus =
  | 'pending'
  | 'leased'
  | 'syncing'
  | 'retry_wait'
  | 'completed'
  | 'failed'
  | 'failed_permanent'
  | 'dead_letter'
  | 'discarded'
  | 'cancelled';

export interface SyncQueue {
  id?: number;
  queue_id: string;
  operation_type: string;
  entity_type: 'survey' | 'response' | 'user' | 'file' | 'field_session';
  entity_id: string;
  payload_json: string;
  status: SyncQueueStatus;
  priority: number;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  last_error?: string;
  last_error_code?: string;
  lease_owner?: string;
  lease_until?: string;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  completed_at?: string;
}

export interface KVCache {
  cache_key: string;
  cache_value: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FileBlob {
  id?: number;
  file_id: string;
  response_id: string;
  blob: Blob;
  created_at: string;
}

/**
 * FIELD-TRACK-1 — brigadista route session.
 *
 * Mirrors the mobile SQLite table so both clients speak the same wire format.
 * The browser is the source of truth until `server_id` is filled in by the
 * queue, which is what lets a session start while offline.
 */
export interface FieldSession {
  client_id: string;
  server_id?: number;
  activity_type: string;
  survey_id?: number | null;
  campaign_id?: number | null;
  entitlement_id?: number | null;
  status: 'active' | 'completed' | 'abandoned';
  started_at: string;
  ended_at?: string;
  end_reason?: string;
  config_json: string;
  degraded_reason?: string;
  /** Next `sample_seq` to hand out; monotonic, never reused. */
  next_seq: number;
  sample_count: number;
  distance_m: number;
  last_lat?: number;
  last_lng?: number;
  last_sample_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FieldSessionSample {
  id?: number;
  session_client_id: string;
  sample_seq: number;
  sample_type: 'gps' | 'photo' | 'gap';
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  altitude_m?: number;
  speed_mps?: number;
  heading_deg?: number;
  recorded_at: string;
  provider?: string;
  app_state?: 'foreground' | 'background' | 'hidden';
  is_mocked?: boolean;
  battery_pct?: number;
  media_file_id?: string;
  payload_json?: string;
  upload_status: 'pending' | 'uploaded';
  uploaded_at?: string;
  created_at: string;
}

export interface StaticMap {
  map_id: number;
  name: string;
  description: string | null;
  version: number;
  manifest_etag: string;
  published_at: string;
  synced_at: string;
}

export interface StaticMapFeature {
  /** Stable local key; backend feature ids are only assumed unique within a map/layer. */
  feature_key: string;
  feature_id: number;
  map_id: number;
  layer_id: number;
  layer_name: string;
  layer_type: string;
  geometry_json: string;
  properties_json: string | null;
}

class BrigadaDatabase extends Dexie {
  surveys!: Table<Survey>;
  responses!: Table<Response>;
  response_answers!: Table<ResponseAnswer>;
  local_files!: Table<LocalFile>;
  sync_queue!: Table<SyncQueue>;
  kv_cache!: Table<KVCache>;
  file_blobs!: Table<FileBlob>;
  field_sessions!: Table<FieldSession>;
  field_session_samples!: Table<FieldSessionSample>;
  static_maps!: Table<StaticMap, number>;
  static_map_features!: Table<StaticMapFeature, string>;

  constructor() {
    super('BrigadaPWA');

    this.version(1).stores({
      surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
      responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
      response_answers: '++id, response_id, question_key, created_at',
      local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
      sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
      kv_cache: 'cache_key, expires_at',
    });

    this.version(2).stores({
      surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
      responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
      response_answers: '++id, response_id, question_key, created_at',
      local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
      sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
      kv_cache: 'cache_key, expires_at',
      file_blobs: '++id, file_id, response_id, created_at',
    });

    // v3: durable assignment cache fields (assignment_json) — same indexes
    this.version(3).stores({
      surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
      responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
      response_answers: '++id, response_id, question_key, created_at',
      local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
      sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
      kv_cache: 'cache_key, expires_at',
      file_blobs: '++id, file_id, response_id, created_at',
    });

    // v4: FIELD-TRACK-1 route sessions. `[session_client_id+sample_seq]` is a
    // compound index rather than a unique one — Dexie cannot express uniqueness
    // on a compound key, so the repository guards duplicates via `next_seq`.
    this.version(4).stores({
      surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
      responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
      response_answers: '++id, response_id, question_key, created_at',
      local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
      sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
      kv_cache: 'cache_key, expires_at',
      file_blobs: '++id, file_id, response_id, created_at',
      field_sessions: 'client_id, status, started_at',
      field_session_samples:
        '++id, session_client_id, upload_status, [session_client_id+sample_seq], [session_client_id+upload_status]',
    });

    // v5: repair coverage-gap markers written as `gps` without coordinates.
    // The API rejects those, and one of them 422s the whole batch on every
    // retry, so a single hidden tab wedged the queue permanently.
    this.version(5)
      .stores({
        surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
        responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
        response_answers: '++id, response_id, question_key, created_at',
        local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
        sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
        kv_cache: 'cache_key, expires_at',
        file_blobs: '++id, file_id, response_id, created_at',
        field_sessions: 'client_id, status, started_at',
        field_session_samples:
          '++id, session_client_id, upload_status, [session_client_id+sample_seq], [session_client_id+upload_status]',
      })
      .upgrade((tx) =>
        tx
          .table('field_session_samples')
          .toCollection()
          .modify((sample: FieldSessionSample) => {
            if (
              sample.sample_type === 'gps' &&
              (sample.latitude == null || sample.longitude == null)
            ) {
              sample.sample_type = 'gap';
            }
          })
      );

    // v6: published operational maps and flattened GeoJSON features for the
    // offline viewer. Existing v1-v5 migrations remain untouched.
    this.version(6).stores({
      surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
      responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
      response_answers: '++id, response_id, question_key, created_at',
      local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
      sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
      kv_cache: 'cache_key, expires_at',
      file_blobs: '++id, file_id, response_id, created_at',
      field_sessions: 'client_id, status, started_at',
      field_session_samples:
        '++id, session_client_id, upload_status, [session_client_id+sample_seq], [session_client_id+upload_status]',
      static_maps: 'map_id, name, version, manifest_etag, published_at, synced_at',
      static_map_features:
        'feature_key, feature_id, map_id, layer_id, layer_type, [map_id+layer_id], [map_id+layer_type]',
    });

    // v7: rename assignment_json → entitlement_json on cached survey rows.
    this.version(7)
      .stores({
        surveys: '++id, survey_id, version, title, sync_status, last_synced_at, created_at',
        responses: '++id, response_id, survey_id, status, sync_status, brigadista_user_id, created_at, updated_at',
        response_answers: '++id, response_id, question_key, created_at',
        local_files: '++id, file_id, response_id, file_type, sync_status, created_at',
        sync_queue: '++id, queue_id, operation_type, entity_type, entity_id, status, priority, next_retry_at, created_at',
        kv_cache: 'cache_key, expires_at',
        file_blobs: '++id, file_id, response_id, created_at',
        field_sessions: 'client_id, status, started_at',
        field_session_samples:
          '++id, session_client_id, upload_status, [session_client_id+sample_seq], [session_client_id+upload_status]',
        static_maps: 'map_id, name, version, manifest_etag, published_at, synced_at',
        static_map_features:
          'feature_key, feature_id, map_id, layer_id, layer_type, [map_id+layer_id], [map_id+layer_type]',
      })
      .upgrade((tx) =>
        tx
          .table('surveys')
          .toCollection()
          .modify((row: Survey & { assignment_json?: string }) => {
            if (row.assignment_json && !row.entitlement_json) {
              row.entitlement_json = row.assignment_json;
            }
            delete row.assignment_json;
          }),
      );
  }
}

export const db = new BrigadaDatabase();
export const DB_VERSION = 7;

const PROCESS_LOCK_KEY = 'sync_process_lock';
const LEASE_OWNER = `pwa-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : 'local'}`;
const LEASE_MS = 120_000;

export function getLeaseOwner(): string {
  return LEASE_OWNER;
}

export function getLeaseDurationMs(): number {
  return LEASE_MS;
}

export async function initializeDatabase(): Promise<void> {
  await db.open();
  await migrateEntitlementCacheKeys({
    getItem: kvGet,
    setItem: (key, value) => kvSet(key, value),
    removeItem: kvRemove,
  });
}

export async function closeDatabase(): Promise<void> {
  await db.close();
}

export async function clearDatabase(): Promise<void> {
  await db.surveys.clear();
  await db.responses.clear();
  await db.response_answers.clear();
  await db.local_files.clear();
  await db.sync_queue.clear();
  await db.kv_cache.clear();
  await db.file_blobs.clear();
  await db.field_sessions.clear();
  await db.field_session_samples.clear();
  await db.static_maps.clear();
  await db.static_map_features.clear();
}

export async function kvGet(key: string): Promise<string | null> {
  const row = await db.kv_cache.get(key);
  if (!row) return null;
  if (row.expires_at && row.expires_at < new Date().toISOString()) {
    await db.kv_cache.delete(key);
    return null;
  }
  return row.cache_value;
}

export async function kvSet(
  key: string,
  value: string,
  expiresAt?: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.kv_cache.put({
    cache_key: key,
    cache_value: value,
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  });
}

export async function kvRemove(key: string): Promise<void> {
  await db.kv_cache.delete(key);
}

export async function acquireProcessLock(): Promise<boolean> {
  const now = Date.now();
  const existing = await kvGet(PROCESS_LOCK_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { owner: string; until: number };
      if (parsed.until > now && parsed.owner !== LEASE_OWNER) {
        return false;
      }
    } catch {
      /* take over corrupt lock */
    }
  }
  await kvSet(
    PROCESS_LOCK_KEY,
    JSON.stringify({ owner: LEASE_OWNER, until: now + LEASE_MS })
  );
  return true;
}

export async function releaseProcessLock(): Promise<void> {
  const existing = await kvGet(PROCESS_LOCK_KEY);
  if (!existing) return;
  try {
    const parsed = JSON.parse(existing) as { owner: string };
    if (parsed.owner === LEASE_OWNER) {
      await kvRemove(PROCESS_LOCK_KEY);
    }
  } catch {
    await kvRemove(PROCESS_LOCK_KEY);
  }
}

export async function forceReleaseStaleLocks(): Promise<void> {
  const now = Date.now();
  const existing = await kvGet(PROCESS_LOCK_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { until: number };
      if (parsed.until <= now) {
        await kvRemove(PROCESS_LOCK_KEY);
      }
    } catch {
      await kvRemove(PROCESS_LOCK_KEY);
    }
  }

  const leased = await db.sync_queue.where('status').equals('leased').toArray();
  for (const item of leased) {
    if (item.id === undefined) continue;
    if (!item.lease_until || item.lease_until <= new Date(now).toISOString()) {
      await db.sync_queue.update(item.id, {
        status: 'pending',
        lease_owner: undefined,
        lease_until: undefined,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Migrate legacy "failed" rows that have a future/past retry into retry_wait
  const failed = await db.sync_queue.where('status').equals('failed').toArray();
  for (const item of failed) {
    if (item.id === undefined) continue;
    if (item.retry_count < item.max_retries) {
      await db.sync_queue.update(item.id, {
        status: 'retry_wait',
        updated_at: new Date().toISOString(),
      });
    }
  }
}
