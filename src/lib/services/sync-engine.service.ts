import { db, SyncQueue, LocalFile, Response } from '@/lib/db/database';
import { loadFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import {
  submitResponse,
  getPresignedUploadUrl,
  confirmFileUpload,
  buildSurveyResponseCreate,
  DocumentUploadRequest,
} from '@/lib/api/survey.service';

interface SyncResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

export interface SyncEngineOptions {
  onProgress?: (message: string) => void;
}

/**
 * Process all pending items in the sync queue.
 */
export async function processSyncQueue(options?: SyncEngineOptions): Promise<void> {
  const now = new Date().toISOString();

  const pendingItems = await db.sync_queue
    .where('status')
    .equals('pending')
    .and((item) => !item.next_retry_at || item.next_retry_at <= now)
    .sortBy('priority');

  for (const item of pendingItems) {
    if (item.id === undefined) continue;

    await db.sync_queue.update(item.id, {
      status: 'syncing',
      updated_at: now,
    });

    let result: SyncResult;

    try {
      if (item.operation_type === 'CREATE_RESPONSE') {
        result = await processResponseItem(item, options);
      } else if (item.operation_type === 'UPLOAD_FILE') {
        result = await processFileItem(item, options);
      } else {
        result = { success: false, error: `Operación no soportada: ${item.operation_type}` };
      }
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      };
    }

    await handleSyncResult(item.id, item, result, options);
  }
}

async function processResponseItem(
  item: SyncQueue,
  options?: SyncEngineOptions
): Promise<SyncResult> {
  const payload = JSON.parse(item.payload_json);
  const {
    response_id,
    version_id,
    answers,
    questions,
    location,
    started_at,
    completed_at,
    device_info,
  } = payload;

  options?.onProgress?.(`Enviando respuesta ${response_id.slice(0, 8)}...`);

  const responseCreate = buildSurveyResponseCreate(
    response_id,
    version_id,
    answers,
    questions || [],
    location,
    {
      device_platform: device_info.platform,
      device_os_version: device_info.osVersion,
      device_app_version: device_info.appVersion,
      started_at,
      completed_at,
      duration_seconds: 0,
    }
  );

  await submitResponse(responseCreate);

  // Mark response as synced
  const response = await db.responses.where('response_id').equals(response_id).first();
  if (response?.id !== undefined) {
    await db.responses.update(response.id, {
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { success: true };
}

async function processFileItem(
  item: SyncQueue,
  options?: SyncEngineOptions
): Promise<SyncResult> {
  const payload = JSON.parse(item.payload_json);
  const { file_id, response_id, question_id, file_type, ine_ocr_data } = payload;

  const localFile = await db.local_files.where('file_id').equals(file_id).first();
  if (!localFile) {
    return { success: false, error: 'Archivo local no encontrado' };
  }

  options?.onProgress?.(`Subiendo ${localFile.file_name}...`);

  // Reconstruct the File object from the IndexedDB blob if available,
  // otherwise fall back to the thumbnail/preview path (not uploadable).
  let fileBlob: Blob;
  try {
    fileBlob = await loadLocalFileBlob(localFile);
  } catch {
    return { success: false, error: 'No se pudo recuperar el archivo local' };
  }

  const metadata: DocumentUploadRequest['metadata'] = {
    document_type: file_type,
    question_id: Number(question_id),
  };

  if (ine_ocr_data) {
    try {
      const ocr = JSON.parse(ine_ocr_data);
      metadata.ocr_confidence = ocr.ocr_confidence;
      metadata.ocr_text = ocr.ocr_text;
      metadata.ine_modelo = ocr.ine_modelo;
      metadata.ine_ocr_data = ocr.ine_ocr_data;
    } catch {
      // Ignore malformed OCR metadata
    }
  }

  const uploadRequest: DocumentUploadRequest = {
    file_client_id: file_id,
    client_id: response_id,
    file_name: localFile.file_name,
    file_size: localFile.file_size,
    mime_type: localFile.mime_type,
    metadata,
  };

  const uploadInfo = await getPresignedUploadUrl(uploadRequest);

  const uploadUrl = uploadInfo.upload_url || uploadInfo.presigned_url;
  if (!uploadUrl) {
    return { success: false, error: 'URL de subida no disponible' };
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: fileBlob,
    headers: {
      'Content-Type': localFile.mime_type,
    },
  });

  if (!uploadResponse.ok) {
    return {
      success: false,
      error: `Error al subir archivo: ${uploadResponse.status}`,
    };
  }

  const storageKey = uploadInfo.storage_key || extractStorageKeyFromUrl(uploadUrl);
  const remoteUrl = uploadInfo.remote_url || uploadUrl.split('?')[0];

  await confirmFileUpload({
    document_id: uploadInfo.document_id,
    remote_url: remoteUrl,
    storage_key: storageKey,
  });

  // Update local file record
  if (localFile.id !== undefined) {
    await db.local_files.update(localFile.id, {
      sync_status: 'uploaded',
      document_id: uploadInfo.document_id,
      storage_key: storageKey,
      remote_url: remoteUrl,
      uploaded_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Partial<LocalFile>);
  }

  // Free up IndexedDB space now that the file is uploaded.
  await deleteFileBlob(localFile.file_id);

  return { success: true };
}

async function handleSyncResult(
  itemId: number,
  item: SyncQueue,
  result: SyncResult,
  options?: SyncEngineOptions
): Promise<void> {
  const now = new Date().toISOString();

  if (result.success) {
    await db.sync_queue.update(itemId, {
      status: 'completed',
      completed_at: now,
      updated_at: now,
    });
    options?.onProgress?.('Sincronización completada');
    return;
  }

  const nextRetry = new Date(Date.now() + calculateBackoff(item.retry_count)).toISOString();
  const isDeadLetter = item.retry_count >= item.max_retries;

  await db.sync_queue.update(itemId, {
    status: isDeadLetter ? 'dead_letter' : 'failed',
    retry_count: item.retry_count + 1,
    next_retry_at: isDeadLetter ? undefined : nextRetry,
    last_error: result.error,
    last_error_code: result.errorCode,
    updated_at: now,
  });

  if (item.entity_type === 'response' && item.entity_id) {
    const response = await db.responses
      .where('response_id')
      .equals(item.entity_id)
      .first();

    if (response?.id !== undefined) {
      await db.responses.update(response.id, {
        sync_status: isDeadLetter ? 'error' : 'pending',
        sync_attempts: item.retry_count + 1,
        last_sync_attempt_at: now,
        last_sync_error: result.error,
        updated_at: now,
      } as Partial<Response>);
    }
  }

  options?.onProgress?.(`Error de sincronización: ${result.error}`);
}

function calculateBackoff(retryCount: number): number {
  // Exponential backoff: 2s, 4s, 8s, 16s, 32s
  return Math.min(1000 * 2 ** (retryCount + 1), 32000);
}

function extractStorageKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}

/**
 * Load the actual file blob for a local file record.
 * First tries IndexedDB blob storage, then falls back to the in-memory blob URL.
 */
async function loadLocalFileBlob(localFile: LocalFile): Promise<Blob> {
  // Try the persistent IndexedDB blob first.
  const persistentBlob = await loadFileBlob(localFile.file_id);
  if (persistentBlob) {
    return persistentBlob;
  }

  // Fallback to the in-memory blob URL (valid only during the same session).
  if (localFile.thumbnail_path?.startsWith('blob:')) {
    const response = await fetch(localFile.thumbnail_path);
    return response.blob();
  }

  throw new Error('No se encontró el contenido del archivo');
}
