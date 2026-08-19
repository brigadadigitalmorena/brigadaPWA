import apiClient from './client';
import {
  Assignment,
  SurveyVersion,
  SurveyFormData,
  LocationData,
  ResponseMetadata,
} from '@/lib/types';
import {
  cacheEntitlement,
  normalizeSurveyVersion,
  readCachedEntitlement,
} from '@/lib/utils/survey-version';
import {
  persistEntitlements,
  readDurableEntitlements,
  readCachedSurveyVersion,
} from '@/lib/services/entitlement-cache.service';
import {
  geoLocationRequired,
  GEO_ERROR_MESSAGES,
  matchEntitlement,
} from '@/lib/campaigns/scope';
import { isAcceptedBatchStatus } from '@/lib/sync';

export interface QuestionAnswerCreate {
  question_id: number;
  answer_value?: unknown;
  media_url?: string | null;
  answered_at: string;
  answer_meta?: Record<string, unknown>;
  evaluated_label?: string | null;
}

export interface SurveyResponseCreate {
  client_id: string;
  version_id: number;
  schema_hash?: string | null;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
  } | null;
  started_at?: string;
  completed_at: string;
  device_info?: Record<string, unknown>;
  capture_meta?: Record<string, unknown>;
  answers: QuestionAnswerCreate[];
  is_management?: boolean;
  campaign_id?: number | null;
  entitlement_id?: number | null;
  /** FIELD-TRACK-1 — UUID of the route session open when this was submitted. */
  field_session_client_id?: string | null;
}

export interface BatchResponseCreate {
  responses: SurveyResponseCreate[];
  events?: unknown[];
}

export interface BatchResponseResult {
  client_id?: string;
  status?: string;
  message?: string;
}

export interface DocumentUploadRequest {
  file_client_id?: string;
  client_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  metadata: {
    document_type: string;
    question_id?: number;
    ocr_confidence?: number;
    ocr_text?: string;
    page_number?: number;
    ine_modelo?: string;
    ine_ocr_data?: Record<string, unknown>;
  };
}

export interface DocumentUploadResponse {
  document_id: string;
  presigned_url: string;
  upload_url?: string;
  remote_url?: string;
  storage_key?: string;
  ocr_required?: boolean;
  low_confidence_warning?: boolean;
}

export interface DocumentConfirmRequest {
  document_id: string;
  remote_url: string;
  storage_key: string;
}

type GeoEntitlement = Pick<Assignment, 'geo_enforcement' | 'area_names'>;

/**
 * Capture GPS when the campaign enforces block-mode geo with configured areas.
 */
export async function captureLocationIfRequired(
  entitlement: GeoEntitlement | null | undefined,
  existing: LocationData | null,
): Promise<LocationData | null> {
  if (
    !entitlement ||
    !geoLocationRequired(entitlement.geo_enforcement, entitlement.area_names)
  ) {
    return existing;
  }

  if (existing?.latitude != null && existing?.longitude != null) {
    return existing;
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error(GEO_ERROR_MESSAGES.GEO_LOCATION_REQUIRED);
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 0,
          captured_at: new Date(position.timestamp).toISOString(),
        });
      },
      () => reject(new Error(GEO_ERROR_MESSAGES.GEO_LOCATION_REQUIRED)),
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 },
    );
  });
}

/**
 * Get my assigned surveys (network-first with durable Dexie fallback).
 */
export async function getMyEntitlements(): Promise<Assignment[]> {
  try {
    const response = await apiClient.get<Assignment[]>('/mobile/surveys');
    await persistEntitlements(response.data);
    return response.data;
  } catch (err) {
    const cached = await readDurableEntitlements();
    if (cached.length > 0) {
      console.warn('Using durable entitlement cache (offline)', err);
      return cached;
    }
    throw err;
  }
}

/** @deprecated Use getMyEntitlements */
export const getMyAssignments = getMyEntitlements;

export async function getEntitlementForSurvey(
  surveyId: number,
  options?: { campaignId?: number | null; entitlementId?: number | null },
): Promise<Assignment | null> {
  const entitlements = await getMyEntitlements();
  return matchEntitlement(entitlements, surveyId, options) ?? null;
}

/** @deprecated Use getEntitlementForSurvey */
export const getAssignmentForSurvey = getEntitlementForSurvey;

export async function getSurveyTitle(surveyId: number): Promise<string> {
  const session = readCachedEntitlement(surveyId);
  if (session?.survey_title) return session.survey_title;

  const durable = await readCachedSurveyVersion(surveyId);
  if (durable?.title) return durable.title;

  const entitlement = await getEntitlementForSurvey(surveyId);
  return entitlement?.survey_title ?? `Encuesta #${surveyId}`;
}

/**
 * Load survey version for fill — session → Dexie → network.
 */
export async function loadSurveyForFill(
  surveyId: number,
  titleFromUrl?: string | null,
  options?: { campaignId?: number | null; entitlementId?: number | null },
): Promise<{ title: string; version: SurveyVersion }> {
  const session = readCachedEntitlement(surveyId, options?.campaignId);
  if (session?.latest_version) {
    return {
      title: titleFromUrl ?? session.survey_title,
      version: normalizeSurveyVersion(session.latest_version),
    };
  }

  const durable = await readCachedSurveyVersion(surveyId);
  if (durable && options?.campaignId == null && options?.entitlementId == null) {
    return {
      title: titleFromUrl ?? durable.title,
      version: durable.version,
    };
  }

  const entitlement = await getEntitlementForSurvey(surveyId, options);
  if (!entitlement?.latest_version) {
    throw new Error('No published version available for this survey');
  }

  cacheEntitlement(surveyId, entitlement);
  await persistEntitlements([entitlement]);

  return {
    title: titleFromUrl ?? entitlement.survey_title,
    version: normalizeSurveyVersion(entitlement.latest_version),
  };
}

export async function getLatestSurveyVersion(surveyId: number): Promise<SurveyVersion> {
  const { version } = await loadSurveyForFill(surveyId);
  return version;
}

export async function submitBatchResponses(
  batch: BatchResponseCreate,
): Promise<{ results?: BatchResponseResult[]; status?: string }> {
  const response = await apiClient.post<{
    results?: BatchResponseResult[];
    status?: string;
  }>('/mobile/responses/batch', batch);
  return response.data;
}

export async function submitResponse(
  responseData: SurveyResponseCreate,
): Promise<{ results?: BatchResponseResult[]; status?: string }> {
  const result = await submitBatchResponses({ responses: [responseData] });

  if (!result.results && isAcceptedBatchStatus(result.status ?? 'success')) {
    return {
      results: [{ client_id: responseData.client_id, status: result.status ?? 'success' }],
      status: result.status ?? 'success',
    };
  }

  return result;
}

export async function getPresignedUploadUrl(
  request: DocumentUploadRequest,
): Promise<DocumentUploadResponse> {
  const response = await apiClient.post<DocumentUploadResponse>(
    '/mobile/documents/upload',
    request,
  );
  return response.data;
}

export async function confirmFileUpload(
  request: DocumentConfirmRequest,
): Promise<unknown> {
  const response = await apiClient.post<unknown>('/mobile/documents/confirm', request);
  return response.data;
}

export async function getMyResponses(): Promise<SurveyFormData[]> {
  const response = await apiClient.get<SurveyFormData[]>('/mobile/responses/me');
  return response.data;
}

function resolveAnswerValue(
  answers: Record<string, unknown>,
  question: { id: number; question_key?: string },
): unknown {
  const key = question.question_key?.trim();
  if (key && answers[key] !== undefined) {
    return answers[key];
  }
  const idKey = String(question.id);
  if (answers[idKey] !== undefined) {
    return answers[idKey];
  }
  return undefined;
}

export interface FileAnswerRef {
  question_id: number;
  file_id: string;
  file_type: string;
}

/**
 * Build the mobile batch payload. Resolves answers by question_key or id,
 * and attaches pending_upload media refs so media-only questions still produce
 * a non-empty answers[] (backend requires min_length=1).
 */
export function buildSurveyResponseCreate(
  responseId: string,
  versionId: number,
  answers: Record<string, unknown>,
  questions: { id: number; question_key?: string }[],
  location: LocationData | null,
  metadata: ResponseMetadata,
  fileAnswers: FileAnswerRef[] = [],
  options: {
    isManagement?: boolean;
    campaignId?: number | null;
    entitlementId?: number | null;
    /**
     * FIELD-TRACK-1 — route session open at submit time, so the CMS can pin
     * this response onto the track line.
     */
    fieldSessionClientId?: string | null;
    geoEntitlement?: GeoEntitlement | null;
  } = {},
): SurveyResponseCreate {
  if (
    options.geoEntitlement &&
    geoLocationRequired(
      options.geoEntitlement.geo_enforcement,
      options.geoEntitlement.area_names,
    ) &&
    (location?.latitude == null || location?.longitude == null)
  ) {
    throw new Error(GEO_ERROR_MESSAGES.GEO_LOCATION_REQUIRED);
  }

  const now = new Date().toISOString();
  const byQuestion = new Map<number, QuestionAnswerCreate>();

  for (const question of questions) {
    const value = resolveAnswerValue(answers, question);
    if (value === undefined) continue;
    byQuestion.set(question.id, {
      question_id: question.id,
      answer_value: value,
      answered_at: now,
      answer_meta: {},
      media_url: null,
      evaluated_label: null,
    });
  }

  for (const file of fileAnswers) {
    if (!Number.isFinite(file.question_id) || file.question_id <= 0) continue;
    const mediaUrl = `pending_upload:${file.file_id}`;
    const existing = byQuestion.get(file.question_id);
    if (existing) {
      existing.media_url = mediaUrl;
      if (existing.answer_value == null) {
        existing.answer_value = { file_id: file.file_id, type: file.file_type };
      }
      continue;
    }
    byQuestion.set(file.question_id, {
      question_id: file.question_id,
      answer_value: { file_id: file.file_id, type: file.file_type },
      answered_at: now,
      answer_meta: {},
      media_url: mediaUrl,
      evaluated_label: null,
    });
  }

  const answerEntries = Array.from(byQuestion.values());
  if (answerEntries.length === 0) {
    throw new Error(
      'La respuesta no tiene respuestas para enviar. Completa al menos una pregunta.',
    );
  }

  return {
    client_id: responseId,
    version_id: versionId,
    location: location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.captured_at,
        }
      : null,
    started_at: metadata.started_at,
    completed_at: metadata.completed_at || now,
    device_info: {
      platform: metadata.device_platform,
      os_version: metadata.device_os_version,
      app_version: metadata.device_app_version,
    },
    capture_meta: {},
    answers: answerEntries,
    is_management: Boolean(options.isManagement),
    ...(options.campaignId != null ? { campaign_id: options.campaignId } : {}),
    ...(options.entitlementId != null
      ? { entitlement_id: options.entitlementId }
      : {}),
    ...(options.fieldSessionClientId
      ? { field_session_client_id: options.fieldSessionClientId }
      : {}),
  };
}
