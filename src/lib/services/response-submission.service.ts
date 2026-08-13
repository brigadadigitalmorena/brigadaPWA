import { db, Response, LocalFile } from '@/lib/db/database';
import { SurveyVersion, LocationData } from '@/lib/types';
import { getCurrentUser } from '@/lib/api/auth.service';
import { LocalFilePreview } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { SYNC_PRIORITY } from '@/lib/sync';
import { readCachedAssignment } from '@/lib/utils/survey-version';
import { fieldSessionService } from '@/lib/services/field-session.service';

export interface FinalizeResponseInput {
  responseId: string;
  surveyId: string;
  version: SurveyVersion;
  answers: Record<string, unknown>;
  files: Record<string, LocalFilePreview[]>;
  location: LocationData | null;
  startedAt: string;
  deviceInfo: {
    platform: string;
    osVersion: string;
    appVersion: string;
  };
  surveyType?: string | null;
}

function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';
}

function resolveSurveyType(
  surveyId: string,
  explicitType?: string | null
): string | undefined {
  if (explicitType) return explicitType;
  const numericId = Number(surveyId);
  if (!Number.isFinite(numericId)) return undefined;
  const session = readCachedAssignment(numericId);
  if (session?.survey_type) return session.survey_type;
  return undefined;
}

/**
 * Persist a finalized survey response and its files locally, then queue them
 * for synchronization.
 */
export async function finalizeResponse(input: FinalizeResponseInput): Promise<void> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const now = new Date().toISOString();
  const versionString = input.version.version_number.toString();
  const surveyType = resolveSurveyType(input.surveyId, input.surveyType);
  const isManagement = surveyType === 'gestion';
  // FIELD-TRACK-1 — resolved now, not at sync time: by the time the queue
  // drains, the brigadista may have already ended this route.
  const fieldSessionClientId =
    await fieldSessionService.getActiveSessionClientId();

  const response: Response = {
    response_id: input.responseId,
    survey_id: input.surveyId,
    survey_version: versionString,
    status: 'completed',
    answers_json: JSON.stringify(input.answers),
    brigadista_user_id: user.id.toString(),
    brigadista_name: `${user.nombre} ${user.apellido}`,
    brigadista_role: user.role_key,
    latitude: input.location?.latitude,
    longitude: input.location?.longitude,
    accuracy: input.location?.accuracy,
    location_captured_at: input.location?.captured_at,
    device_platform: input.deviceInfo.platform,
    device_os_version: input.deviceInfo.osVersion,
    device_app_version: input.deviceInfo.appVersion,
    started_at: input.startedAt,
    completed_at: now,
    duration_seconds: Math.max(
      0,
      Math.round((new Date(now).getTime() - new Date(input.startedAt).getTime()) / 1000)
    ),
    validation_status: 'pending',
    sync_status: 'pending',
    sync_attempts: 0,
    last_sync_attempt_at: now,
    last_synced_at: undefined,
    sync_error: undefined,
    offline_mode: !navigator.onLine,
    immutable: false,
    integrity_hash: undefined,
    created_at: input.startedAt,
    updated_at: now,
  };

  await db.transaction('rw', db.responses, db.local_files, db.sync_queue, async () => {
    // Upsert the response as completed
    const existing = await db.responses
      .where('response_id')
      .equals(input.responseId)
      .first();

    if (existing?.id !== undefined) {
      response.id = existing.id;
    }

    await db.responses.put(response);

    // Persist local files and queue upload tasks
    const allFiles = Object.values(input.files).flat();

    for (const preview of allFiles) {
      const fileId = preview.fileId || generateLocalId();

      const localFile: LocalFile = {
        file_id: fileId,
        response_id: input.responseId,
        file_type: preview.fileType as LocalFile['file_type'],
        question_id: preview.questionId,
        file_name: preview.file.name,
        file_size: preview.file.size,
        mime_type: preview.file.type || 'application/octet-stream',
        storage_key: undefined,
        remote_url: undefined,
        ine_ocr_data: preview.ineOcrData,
        sync_status: 'pending',
        uploaded_at: undefined,
        upload_started_at: undefined,
        thumbnail_path: preview.previewUrl,
        document_id: undefined,
        presigned_url: undefined,
        presigned_expires_at: undefined,
        confirmed_at: undefined,
        created_at: now,
      };

      const existingFile = await db.local_files
        .where({ response_id: input.responseId, question_id: preview.questionId })
        .first();

      if (existingFile?.id !== undefined) {
        localFile.id = existingFile.id;
      }

      await db.local_files.put(localFile);

      await db.sync_queue.add({
        queue_id: generateLocalId(),
        operation_type: 'UPLOAD_FILE',
        entity_type: 'file',
        entity_id: fileId,
        payload_json: JSON.stringify({
          file_id: fileId,
          response_id: input.responseId,
          question_id: preview.questionId,
          file_name: preview.file.name,
          file_size: preview.file.size,
          mime_type: preview.file.type || 'application/octet-stream',
          file_type: preview.fileType,
          ine_ocr_data: preview.ineOcrData,
        }),
        status: 'pending',
        // Files after responses (mobile parity).
        priority: SYNC_PRIORITY.FILE,
        retry_count: 0,
        max_retries: 12,
        next_retry_at: now,
        last_error: undefined,
        last_error_code: undefined,
        lease_owner: undefined,
        lease_until: undefined,
        created_at: now,
        updated_at: now,
        processed_at: undefined,
        completed_at: undefined,
      });
    }

    // Queue the response submission
    await db.sync_queue.add({
      queue_id: generateLocalId(),
      operation_type: 'CREATE_RESPONSE',
      entity_type: 'response',
      entity_id: input.responseId,
      payload_json: JSON.stringify({
        response_id: input.responseId,
        version_id: input.version.id,
        answers: input.answers,
        questions: input.version.sections
          ?.flatMap((s) => s.questions || [])
          .map((q) => ({ id: q.id, question_key: q.question_key })),
        location: input.location,
        started_at: input.startedAt,
        completed_at: now,
        device_info: input.deviceInfo,
        survey_type: surveyType ?? null,
        is_management: isManagement,
        field_session_client_id: fieldSessionClientId,
      }),
      status: 'pending',
      priority: isManagement ? SYNC_PRIORITY.GESTION : SYNC_PRIORITY.RESPONSE,
      retry_count: 0,
      max_retries: 8,
      next_retry_at: now,
      last_error: undefined,
      last_error_code: undefined,
      lease_owner: undefined,
      lease_until: undefined,
      created_at: now,
      updated_at: now,
      processed_at: undefined,
      completed_at: undefined,
    });
  });
}

/**
 * Build the device metadata object used during submission.
 */
export function buildDeviceInfo(): {
  platform: string;
  osVersion: string;
  appVersion: string;
} {
  return {
    platform: 'web',
    osVersion: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    appVersion: getAppVersion(),
  };
}
