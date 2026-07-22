import Dexie, { Table } from 'dexie';

// Survey types
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
  created_at: string;
  updated_at: string;
}

// Response types
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

// Response Answer types
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

// Local File types
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

// Sync Queue types
export interface SyncQueue {
  id?: number;
  queue_id: string;
  operation_type: string;
  entity_type: 'survey' | 'response' | 'user' | 'file';
  entity_id: string;
  payload_json: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'dead_letter';
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

// KV Cache types
export interface KVCache {
  cache_key: string;
  cache_value: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// File Blob types (stores actual file content for offline survival)
export interface FileBlob {
  id?: number;
  file_id: string;
  response_id: string;
  blob: Blob;
  created_at: string;
}

// Database class
class BrigadaDatabase extends Dexie {
  surveys!: Table<Survey>;
  responses!: Table<Response>;
  response_answers!: Table<ResponseAnswer>;
  local_files!: Table<LocalFile>;
  sync_queue!: Table<SyncQueue>;
  kv_cache!: Table<KVCache>;
  file_blobs!: Table<FileBlob>;

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
  }
}

// Create singleton instance
export const db = new BrigadaDatabase();

// Database version
export const DB_VERSION = 2;

// Initialize database
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Close database
export async function closeDatabase(): Promise<void> {
  try {
    await db.close();
    console.log('Database closed successfully');
  } catch (error) {
    console.error('Failed to close database:', error);
  }
}

// Clear all data (for logout)
export async function clearDatabase(): Promise<void> {
  try {
    await db.surveys.clear();
    await db.responses.clear();
    await db.response_answers.clear();
    await db.local_files.clear();
    await db.sync_queue.clear();
    await db.kv_cache.clear();
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Failed to clear database:', error);
    throw error;
  }
}
