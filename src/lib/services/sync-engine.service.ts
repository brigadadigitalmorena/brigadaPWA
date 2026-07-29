import {
  db,
  SyncQueue,
  LocalFile,
  Response,
  acquireProcessLock,
  releaseProcessLock,
  forceReleaseStaleLocks,
  getLeaseOwner,
  getLeaseDurationMs,
} from '@/lib/db/database';
import { loadFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import {
  submitResponse,
  getPresignedUploadUrl,
  confirmFileUpload,
  buildSurveyResponseCreate,
  DocumentUploadRequest,
} from '@/lib/api/survey.service';
import {
  isAcceptedBatchStatus,
  nextRetryAtIso,
  classifySubmitError,
  recordSubmitOutcome,
  normalizeConfirmDocumentPayload,
} from '@/lib/sync';

interface SyncResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  permanent?: boolean;
}

export interface SyncEngineOptions {
  onProgress?: (message: string) => void;
}

const inFlightUploads = new Set<string>();

/**
 * Process due items in the sync queue (pending + retry_wait).
 */
export async function processSyncQueue(options?: SyncEngineOptions): Promise<void> {
  await forceReleaseStaleLocks();

  const locked = await acquireProcessLock();
  if (!locked) {
    options?.onProgress?.('Otra sincronización está en curso');
    return;
  }

  try {
    const now = new Date().toISOString();
    const candidates = await db.sync_queue
      .filter(
        (item) =>
          (item.status === 'pending' || item.status === 'retry_wait') &&
          (!item.next_retry_at || item.next_retry_at <= now)
      )
      .toArray();

    candidates.sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));

    for (const item of candidates) {
      if (item.id === undefined) continue;

      const leased = await leaseItem(item);
      if (!leased) continue;

      let result: SyncResult;
      try {
        if (item.operation_type === 'CREATE_RESPONSE') {
          result = await processResponseItem(item, options);
        } else if (item.operation_type === 'UPLOAD_FILE') {
          result = await processFileItem(item, options);
        } else if (item.operation_type === 'CONFIRM_DOCUMENT') {
          result = await processConfirmItem(item, options);
        } else {
          result = {
            success: false,
            error: `Operación no soportada: ${item.operation_type}`,
            permanent: true,
          };
        }
      } catch (err) {
        const outcome = classifySubmitError(err);
        recordSubmitOutcome(outcome);
        result = {
          success: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
          errorCode: outcome === 'network_failure' ? 'NETWORK_FAILURE' : 'SYNC_ERROR',
        };
      }

      await handleSyncResult(item.id, item, result, options);
    }

    await recoverOrphanUploads(options);
  } finally {
    await releaseProcessLock();
  }
}

async function leaseItem(item: SyncQueue): Promise<boolean> {
  if (item.id === undefined) return false;
  const now = Date.now();
  const leaseUntil = new Date(now + getLeaseDurationMs()).toISOString();
  await db.sync_queue.update(item.id, {
    status: 'leased',
    lease_owner: getLeaseOwner(),
    lease_until: leaseUntil,
    updated_at: new Date().toISOString(),
  });
  return true;
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

  options?.onProgress?.(`Enviando respuesta ${String(response_id).slice(0, 8)}...`);

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

  try {
    const batchResult = (await submitResponse(responseCreate)) as {
      results?: { client_id?: string; status?: string; message?: string }[];
      status?: string;
    };

    const detail =
      batchResult?.results?.find((r) => r.client_id === response_id) ??
      batchResult?.results?.[0];

    const status = detail?.status ?? batchResult?.status ?? 'success';
    if (!isAcceptedBatchStatus(status)) {
      recordSubmitOutcome('non_network_error');
      return {
        success: false,
        error: detail?.message || `Rechazado: ${status}`,
        errorCode: status === 'failed' ? 'SERVER_REJECTED' : 'BATCH_REJECTED',
        permanent: status === 'failed',
      };
    }

    // duplicate / success / synced / partial → success
    recordSubmitOutcome('success');

    const response = await db.responses.where('response_id').equals(response_id).first();
    if (response?.id !== undefined) {
      await db.responses.update(response.id, {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        sync_error: undefined,
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (err) {
    const outcome = classifySubmitError(err);
    recordSubmitOutcome(outcome);
    throw err;
  }
}

async function processFileItem(
  item: SyncQueue,
  options?: SyncEngineOptions
): Promise<SyncResult> {
  const payload = JSON.parse(item.payload_json);
  const { file_id, response_id, question_id, file_type, ine_ocr_data } = payload;

  if (inFlightUploads.has(file_id)) {
    return { success: false, error: 'Upload already in flight', errorCode: 'IN_FLIGHT' };
  }

  const localFile = await db.local_files.where('file_id').equals(file_id).first();
  if (!localFile) {
    return {
      success: false,
      error: 'Archivo local no encontrado',
      errorCode: 'LOCAL_FILE_MISSING',
      permanent: true,
    };
  }

  // Reuse cached presign if still valid
  const now = Date.now();
  const hasValidPresign =
    localFile.presigned_url &&
    localFile.presigned_expires_at &&
    new Date(localFile.presigned_expires_at).getTime() > now + 30_000 &&
    localFile.document_id &&
    localFile.storage_key;

  options?.onProgress?.(`Subiendo ${localFile.file_name}...`);

  let fileBlob: Blob;
  try {
    fileBlob = await loadLocalFileBlob(localFile);
  } catch {
    return {
      success: false,
      error: 'No se pudo recuperar el archivo local',
      errorCode: 'BLOB_MISSING',
      permanent: true,
    };
  }

  inFlightUploads.add(file_id);
  try {
    if (localFile.id !== undefined) {
      await db.local_files.update(localFile.id, {
        sync_status: 'uploading',
        upload_started_at: new Date().toISOString(),
      });
    }

    let documentId = localFile.document_id;
    let uploadUrl = localFile.presigned_url;
    let storageKey = localFile.storage_key;
    let remoteUrl = localFile.remote_url;

    if (!hasValidPresign) {
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
          /* ignore */
        }
      }

      const uploadInfo = await getPresignedUploadUrl({
        file_client_id: file_id,
        client_id: response_id,
        file_name: localFile.file_name,
        file_size: localFile.file_size,
        mime_type: localFile.mime_type,
        metadata,
      });

      documentId = uploadInfo.document_id;
      uploadUrl = uploadInfo.upload_url || uploadInfo.presigned_url;
      storageKey = uploadInfo.storage_key || (uploadUrl ? extractStorageKeyFromUrl(uploadUrl) : undefined);
      remoteUrl = uploadInfo.remote_url || (uploadUrl ? uploadUrl.split('?')[0] : undefined);

      if (localFile.id !== undefined) {
        await db.local_files.update(localFile.id, {
          document_id: documentId,
          presigned_url: uploadUrl,
          // Presigns typically last ~1h; cache 50 min
          presigned_expires_at: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
          storage_key: storageKey,
          remote_url: remoteUrl,
        } as Partial<LocalFile>);
      }
    }

    if (!uploadUrl || !documentId || !storageKey) {
      return { success: false, error: 'URL de subida no disponible', errorCode: 'PRESIGN_MISSING' };
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBlob,
      headers: { 'Content-Type': localFile.mime_type },
    });

    if (!uploadResponse.ok) {
      const code =
        uploadResponse.status === 403
          ? 'R2_403_EXPIRED'
          : uploadResponse.status === 429
            ? 'R2_RATE_LIMITED'
            : 'R2_PUT_FAILED';
      // Invalidate expired presign
      if (code === 'R2_403_EXPIRED' && localFile.id !== undefined) {
        await db.local_files.update(localFile.id, {
          presigned_url: undefined,
          presigned_expires_at: undefined,
        } as Partial<LocalFile>);
      }
      return {
        success: false,
        error: `Error al subir archivo: ${uploadResponse.status}`,
        errorCode: code,
      };
    }

    const finalRemote = remoteUrl || uploadUrl.split('?')[0];
    await confirmFileUpload({
      document_id: documentId,
      remote_url: finalRemote,
      storage_key: storageKey,
    });

    if (localFile.id !== undefined) {
      await db.local_files.update(localFile.id, {
        sync_status: 'uploaded',
        document_id: documentId,
        storage_key: storageKey,
        remote_url: finalRemote,
        uploaded_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      } as Partial<LocalFile>);
    }

    await deleteFileBlob(localFile.file_id);
    recordSubmitOutcome('success');
    return { success: true };
  } finally {
    inFlightUploads.delete(file_id);
  }
}

async function processConfirmItem(
  item: SyncQueue,
  options?: SyncEngineOptions
): Promise<SyncResult> {
  const payload = JSON.parse(item.payload_json) as {
    document_id?: string;
    remote_url?: string;
    storage_key?: string;
    file_id?: string;
  };

  let fallback: LocalFile | undefined;
  if (payload.file_id) {
    fallback = await db.local_files.where('file_id').equals(payload.file_id).first();
  }

  const normalized = normalizeConfirmDocumentPayload(payload, fallback
    ? {
        document_id: fallback.document_id ?? null,
        remote_url: fallback.remote_url ?? null,
        storage_key: fallback.storage_key ?? null,
      }
    : null);

  if (!normalized) {
    return {
      success: false,
      error: 'Confirm payload incompleto',
      errorCode: 'INVALID_CONFIRM_PAYLOAD',
      permanent: true,
    };
  }

  options?.onProgress?.(`Confirmando documento ${normalized.document_id.slice(0, 8)}...`);
  await confirmFileUpload(normalized);
  return { success: true };
}

/**
 * Re-queue local files that are pending/uploading without an active queue row.
 */
async function recoverOrphanUploads(options?: SyncEngineOptions): Promise<void> {
  const files = await db.local_files
    .filter((f) => f.sync_status === 'pending' || f.sync_status === 'uploading')
    .toArray();

  for (const file of files) {
    if (inFlightUploads.has(file.file_id)) continue;

    // Reset interrupted uploads
    if (
      file.sync_status === 'uploading' &&
      file.upload_started_at &&
      Date.now() - new Date(file.upload_started_at).getTime() > getLeaseDurationMs()
    ) {
      if (file.id !== undefined) {
        await db.local_files.update(file.id, { sync_status: 'pending' });
      }
    }

    const existing = await db.sync_queue
      .where('entity_id')
      .equals(file.file_id)
      .filter(
        (q) =>
          q.operation_type === 'UPLOAD_FILE' &&
          !['completed', 'discarded', 'dead_letter', 'failed_permanent', 'cancelled'].includes(
            q.status
          )
      )
      .first();

    if (existing) continue;

    const now = new Date().toISOString();
    await db.sync_queue.add({
      queue_id: crypto.randomUUID(),
      operation_type: 'UPLOAD_FILE',
      entity_type: 'file',
      entity_id: file.file_id,
      payload_json: JSON.stringify({
        file_id: file.file_id,
        response_id: file.response_id,
        question_id: file.question_id,
        file_name: file.file_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
        file_type: file.file_type,
        ine_ocr_data: file.ine_ocr_data,
      }),
      status: 'pending',
      priority: 10,
      retry_count: 0,
      max_retries: 12,
      next_retry_at: now,
      created_at: now,
      updated_at: now,
    });
    options?.onProgress?.(`Recuperado upload huérfano ${file.file_id.slice(0, 8)}`);
  }
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
      lease_owner: undefined,
      lease_until: undefined,
    });
    options?.onProgress?.('Sincronización completada');
    return;
  }

  if (result.errorCode === 'IN_FLIGHT') {
    await db.sync_queue.update(itemId, {
      status: 'pending',
      lease_owner: undefined,
      lease_until: undefined,
      updated_at: now,
    });
    return;
  }

  const nextCount = item.retry_count + 1;
  const exhausted = nextCount >= item.max_retries;
  const permanent = Boolean(result.permanent) || result.errorCode === 'SERVER_REJECTED';

  let status: SyncQueue['status'];
  if (permanent) {
    status = 'failed_permanent';
  } else if (exhausted) {
    status = 'dead_letter';
  } else {
    status = 'retry_wait';
  }

  await db.sync_queue.update(itemId, {
    status,
    retry_count: nextCount,
    next_retry_at: status === 'retry_wait' ? nextRetryAtIso(item.retry_count) : undefined,
    last_error: result.error,
    last_error_code: result.errorCode,
    updated_at: now,
    lease_owner: undefined,
    lease_until: undefined,
  });

  if (item.entity_type === 'response' && item.entity_id) {
    const response = await db.responses.where('response_id').equals(item.entity_id).first();
    if (response?.id !== undefined) {
      await db.responses.update(response.id, {
        sync_status: status === 'dead_letter' || status === 'failed_permanent' ? 'error' : 'pending',
        sync_attempts: nextCount,
        last_sync_attempt_at: now,
        sync_error: result.error,
        updated_at: now,
      } as Partial<Response>);
    }
  }

  options?.onProgress?.(`Error de sincronización: ${result.error}`);
}

function extractStorageKeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}

async function loadLocalFileBlob(localFile: LocalFile): Promise<Blob> {
  const persistentBlob = await loadFileBlob(localFile.file_id);
  if (persistentBlob) return persistentBlob;

  if (localFile.thumbnail_path?.startsWith('blob:')) {
    const response = await fetch(localFile.thumbnail_path);
    return response.blob();
  }

  throw new Error('No se encontró el contenido del archivo');
}

/** Make all retry_wait items due immediately (reconnect / manual). */
export async function makeRetryWaitDueNow(): Promise<void> {
  const now = new Date().toISOString();
  await db.sync_queue
    .where('status')
    .equals('retry_wait')
    .modify({ next_retry_at: now, updated_at: now });
}

/** Discard dead-letter items (soft delete — never re-queue). */
export async function discardDeadLetter(): Promise<void> {
  const now = new Date().toISOString();
  await db.sync_queue
    .where('status')
    .anyOf(['dead_letter', 'failed_permanent'])
    .modify({ status: 'discarded', updated_at: now });
}

export async function getQueueStats(): Promise<{
  pending: number;
  retryWait: number;
  deadLetter: number;
  failed: number;
}> {
  const [pending, retryWait, deadLetter, failedPermanent, failed] = await Promise.all([
    db.sync_queue.where('status').equals('pending').count(),
    db.sync_queue.where('status').equals('retry_wait').count(),
    db.sync_queue.where('status').equals('dead_letter').count(),
    db.sync_queue.where('status').equals('failed_permanent').count(),
    db.sync_queue.where('status').equals('failed').count(),
  ]);

  return {
    pending: pending + retryWait,
    retryWait,
    deadLetter: deadLetter + failedPermanent + failed,
    failed: failed + failedPermanent,
  };
}
