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
  startFieldSession,
  updateFieldSession,
  uploadFieldSessionSamples,
} from '@/lib/api/field-session.service';
import {
  submitResponse,
  getPresignedUploadUrl,
  confirmFileUpload,
  buildSurveyResponseCreate,
  DocumentUploadRequest,
  FileAnswerRef,
} from '@/lib/api/survey.service';
import {
  isAcceptedBatchStatus,
  nextRetryAtIso,
  classifySubmitError,
  recordSubmitOutcome,
  normalizeConfirmDocumentPayload,
  SYNC_PRIORITY,
} from '@/lib/sync';
import {
  classifySampleReadiness,
  FIELD_SAMPLE_BATCH_SIZE,
  MAX_SAMPLE_BATCHES_PER_RUN,
  operationRank,
  parseSessionConfig,
  toSampleUpload,
} from '@/lib/sync/field-session-replay-utils';
import { getApiErrorMessage } from '@/lib/utils/api-errors';

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

/** Map local file_type / question_type → backend DocumentMetadata.document_type */
function mapFileTypeToDocType(fileType: string | undefined): string {
  const t = (fileType || '').trim().toLowerCase();
  const mapping: Record<string, string> = {
    photo: 'photo',
    selfie: 'photo',
    photo_no_gallery: 'photo',
    photo_canvas: 'photo',
    signature: 'signature',
    ine: 'ine_front',
    ine_front: 'ine_front',
    ine_back: 'ine_back',
    audio: 'audio',
    voice: 'audio',
    video: 'video',
    file: 'form',
    document: 'form',
  };
  return mapping[t] ?? 'photo';
}

function resolveNumericQuestionId(
  raw: string | number | undefined,
  questions: { id: number; question_key?: string }[]
): number | null {
  if (raw == null || raw === '') return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;
  const key = String(raw);
  const match = questions.find(
    (q) => q.question_key === key || String(q.id) === key
  );
  return match?.id ?? null;
}

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

    candidates.sort(
      (a, b) =>
        operationRank(a.operation_type) - operationRank(b.operation_type) ||
        a.priority - b.priority ||
        a.created_at.localeCompare(b.created_at)
    );

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
        } else if (item.operation_type === 'UPSERT_FIELD_SESSION') {
          result = await processFieldSessionItem(item, options);
        } else if (item.operation_type === 'UPLOAD_FIELD_SESSION_SAMPLES') {
          result = await processFieldSamplesItem(item, options);
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
          error: getApiErrorMessage(
            err,
            err instanceof Error ? err.message : 'Error desconocido'
          ),
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
    is_management,
    survey_type,
    field_session_client_id,
  } = payload;

  options?.onProgress?.(`Enviando respuesta ${String(response_id).slice(0, 8)}...`);

  const questionList: { id: number; question_key?: string }[] = Array.isArray(
    questions
  )
    ? questions
    : [];

  const localFiles = await db.local_files
    .where('response_id')
    .equals(response_id)
    .toArray();

  const fileAnswers: FileAnswerRef[] = [];
  for (const file of localFiles) {
    const qid = resolveNumericQuestionId(file.question_id, questionList);
    if (qid == null) continue;
    fileAnswers.push({
      question_id: qid,
      file_id: file.file_id,
      file_type: mapFileTypeToDocType(file.file_type),
    });
  }

  let responseCreate;
  try {
    responseCreate = buildSurveyResponseCreate(
      response_id,
      version_id,
      answers || {},
      questionList,
      location,
      {
        device_platform: device_info?.platform ?? 'web',
        device_os_version: device_info?.osVersion ?? 'unknown',
        device_app_version: device_info?.appVersion ?? '0.1.0',
        started_at,
        completed_at,
        duration_seconds: 0,
      },
      fileAnswers,
      {
        isManagement:
          Boolean(is_management) || survey_type === 'gestion',
        fieldSessionClientId: field_session_client_id ?? null,
      }
    );
  } catch (buildErr) {
    return {
      success: false,
      error:
        buildErr instanceof Error
          ? buildErr.message
          : 'No se pudo armar el envío',
      errorCode: 'INVALID_PAYLOAD',
      permanent: true,
    };
  }

  try {
    const batchResult = (await submitResponse(responseCreate)) as {
      results?: {
        client_id?: string;
        status?: string;
        message?: string;
        errors?: string[];
        reject_category?: string;
      }[];
      status?: string;
      successful?: number;
      failed?: number;
    };

    const detail =
      batchResult?.results?.find((r) => r.client_id === response_id) ??
      batchResult?.results?.[0];

    const status = detail?.status ?? batchResult?.status ?? 'success';
    if (!isAcceptedBatchStatus(status)) {
      recordSubmitOutcome('non_network_error');
      const detailMsg =
        detail?.message ||
        (Array.isArray(detail?.errors) && detail.errors.length > 0
          ? detail.errors.join('; ')
          : null) ||
        `Rechazado: ${status}`;
      const permanent =
        status === 'failed' &&
        (detail?.reject_category === 'permanent' ||
          detail?.reject_category === 'business_reject' ||
          !detail?.reject_category);
      return {
        success: false,
        error: detailMsg,
        errorCode: status === 'failed' ? 'SERVER_REJECTED' : 'BATCH_REJECTED',
        permanent,
      };
    }

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
    const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown } } };
    if (axiosErr.response?.status === 401) {
      return {
        success: false,
        error: 'Sesión expirada. Inicia sesión e intenta de nuevo.',
        errorCode: 'AUTH_REQUIRED',
        permanent: false,
      };
    }
    if (axiosErr.response?.status === 422 || axiosErr.response?.status === 400) {
      const detail = axiosErr.response.data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? JSON.stringify(detail).slice(0, 300)
            : 'Datos inválidos en el envío';
      return {
        success: false,
        error: message,
        errorCode: 'SERVER_REJECTED',
        permanent: true,
      };
    }
    if (
      typeof axiosErr.response?.status === 'number' &&
      axiosErr.response.status >= 500
    ) {
      recordSubmitOutcome('network_failure');
      return {
        success: false,
        error: getApiErrorMessage(
          err,
          `Error del servidor (${axiosErr.response.status})`
        ),
        errorCode: 'SERVER_ERROR',
      };
    }
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
      let numericQuestionId = resolveNumericQuestionId(question_id, []);
      if (numericQuestionId == null) {
        numericQuestionId = resolveNumericQuestionId(localFile.question_id, []);
      }
      if (numericQuestionId == null) {
        const responseQueueItem = await db.sync_queue
          .where('entity_id')
          .equals(response_id)
          .filter((q) => q.operation_type === 'CREATE_RESPONSE')
          .first();
        if (responseQueueItem) {
          try {
            const responsePayload = JSON.parse(responseQueueItem.payload_json);
            numericQuestionId = resolveNumericQuestionId(
              question_id ?? localFile.question_id,
              responsePayload.questions || []
            );
          } catch {
            /* ignore */
          }
        }
      }

      const metadata: DocumentUploadRequest['metadata'] = {
        document_type: mapFileTypeToDocType(file_type || localFile.file_type),
        ...(numericQuestionId != null ? { question_id: numericQuestionId } : {}),
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
      priority: SYNC_PRIORITY.FILE,
      retry_count: 0,
      max_retries: 12,
      next_retry_at: now,
      created_at: now,
      updated_at: now,
    });
    options?.onProgress?.(`Recuperado upload huérfano ${file.file_id.slice(0, 8)}`);
  }
}

/**
 * FIELD-TRACK-1 — push the route session row.
 *
 * The current state is re-read from Dexie rather than trusting the queued
 * payload: the session may have been closed since it was enqueued, and the
 * close (with `ended_at`) is the part that matters most.
 */
async function processFieldSessionItem(
  item: SyncQueue,
  options?: SyncEngineOptions
): Promise<SyncResult> {
  const session = await db.field_sessions.get(item.entity_id);
  if (!session) {
    return {
      success: false,
      error: 'Recorrido local no encontrado',
      errorCode: 'FIELD_SESSION_MISSING',
      permanent: true,
    };
  }

  options?.onProgress?.('Sincronizando recorrido...');

  const remote = await startFieldSession({
    client_id: session.client_id,
    activity_type: session.activity_type,
    survey_id: session.survey_id,
    assignment_id: session.assignment_id,
    started_at: session.started_at,
    config_snapshot: parseSessionConfig(session.config_json),
    degraded_reason: session.degraded_reason ?? null,
    source: 'pwa',
    device_info: {
      platform: 'web',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    },
  });

  await db.field_sessions.update(session.client_id, { server_id: remote.id });

  if (session.status !== 'active') {
    await updateFieldSession(session.client_id, {
      status: session.status,
      ended_at: session.ended_at ?? null,
      end_reason: session.end_reason ?? null,
      degraded_reason: session.degraded_reason ?? null,
    });
  }

  return { success: true };
}

/**
 * FIELD-TRACK-1 — drain pending GPS samples in batches.
 *
 * `sample_seq` makes duplicates a server-side no-op, so a batch whose response
 * is lost costs nothing on retry. Rejected rows are retired along with the
 * accepted ones: they are malformed and would otherwise block the window.
 */
async function processFieldSamplesItem(
  item: SyncQueue,
  options?: SyncEngineOptions
): Promise<SyncResult> {
  const clientId = item.entity_id;
  const session = await db.field_sessions.get(clientId);
  const readiness = classifySampleReadiness(session);

  if (readiness === 'session_missing') {
    return {
      success: false,
      error: 'Recorrido local no encontrado',
      errorCode: 'FIELD_SESSION_MISSING',
      permanent: true,
    };
  }

  if (readiness === 'not_synced') {
    return {
      success: false,
      error: 'El recorrido aún no se ha sincronizado',
      errorCode: 'FIELD_SESSION_NOT_SYNCED',
    };
  }

  for (let batch = 0; batch < MAX_SAMPLE_BATCHES_PER_RUN; batch += 1) {
    const pending = await db.field_session_samples
      .where('[session_client_id+upload_status]')
      .equals([clientId, 'pending'])
      .sortBy('sample_seq');

    if (pending.length === 0) break;

    const slice = pending.slice(0, FIELD_SAMPLE_BATCH_SIZE);
    options?.onProgress?.(`Enviando ${slice.length} puntos del recorrido...`);

    await uploadFieldSessionSamples(clientId, slice.map(toSampleUpload));

    const uploadedAt = new Date().toISOString();
    await db.field_session_samples
      .where('id')
      .anyOf(slice.map((sample) => sample.id!).filter((id) => id !== undefined))
      .modify({ upload_status: 'uploaded', uploaded_at: uploadedAt });
  }

  const remaining = await db.field_session_samples
    .where('[session_client_id+upload_status]')
    .equals([clientId, 'pending'])
    .count();

  if (remaining > 0) {
    // Hit the per-run cap. Return the item to the queue without burning a
    // retry — real progress was made.
    return {
      success: false,
      error: `Quedan ${remaining} puntos por enviar`,
      errorCode: 'IN_FLIGHT',
    };
  }

  await pruneUploadedFieldSamples();
  return { success: true };
}

/** Drop uploaded samples once they are too old to help diagnose anything. */
async function pruneUploadedFieldSamples(olderThanDays = 3): Promise<void> {
  const cutoff = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await db.field_session_samples
    .where('upload_status')
    .equals('uploaded')
    .filter((sample) => Boolean(sample.uploaded_at && sample.uploaded_at < cutoff))
    .delete();
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

  // Auth failures should not burn retries — pause until the user re-logins.
  if (result.errorCode === 'AUTH_REQUIRED') {
    await db.sync_queue.update(itemId, {
      status: 'retry_wait',
      next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      last_error: result.error,
      last_error_code: result.errorCode,
      lease_owner: undefined,
      lease_until: undefined,
      updated_at: now,
    });
    options?.onProgress?.(result.error || 'Sesión expirada');
    return;
  }

  const nextCount = item.retry_count + 1;
  const maxRetries = item.max_retries > 0 ? item.max_retries : 5;
  const exhausted = nextCount >= maxRetries;
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
