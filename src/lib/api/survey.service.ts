import apiClient from './client';
import {
  Assignment,
  SurveyVersion,
  SurveyFormData,
  LocationData,
  ResponseMetadata,
} from '@/lib/types';
import {
  cacheAssignment,
  normalizeSurveyVersion,
  readCachedAssignment,
} from '@/lib/utils/survey-version';
import {
  persistAssignments,
  readDurableAssignments,
  readCachedSurveyVersion,
} from '@/lib/services/assignment-cache.service';
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

/**
 * Get my assigned surveys (network-first with durable Dexie fallback).
 */
export async function getMyAssignments(): Promise<Assignment[]> {
  try {
    const response = await apiClient.get<Assignment[]>('/mobile/surveys');
    await persistAssignments(response.data);
    return response.data;
  } catch (err) {
    const cached = await readDurableAssignments();
    if (cached.length > 0) {
      console.warn('Using durable assignment cache (offline)', err);
      return cached;
    }
    throw err;
  }
}

export async function getAssignmentForSurvey(
  surveyId: number
): Promise<Assignment | null> {
  const assignments = await getMyAssignments();
  return assignments.find((assignment) => assignment.survey_id === surveyId) ?? null;
}

export async function getSurveyTitle(surveyId: number): Promise<string> {
  const session = readCachedAssignment(surveyId);
  if (session?.survey_title) return session.survey_title;

  const durable = await readCachedSurveyVersion(surveyId);
  if (durable?.title) return durable.title;

  const assignment = await getAssignmentForSurvey(surveyId);
  return assignment?.survey_title ?? `Encuesta #${surveyId}`;
}

/**
 * Load survey version for fill — session → Dexie → network.
 */
export async function loadSurveyForFill(
  surveyId: number,
  titleFromUrl?: string | null
): Promise<{ title: string; version: SurveyVersion }> {
  const session = readCachedAssignment(surveyId);
  if (session?.latest_version) {
    return {
      title: titleFromUrl ?? session.survey_title,
      version: normalizeSurveyVersion(session.latest_version),
    };
  }

  const durable = await readCachedSurveyVersion(surveyId);
  if (durable) {
    return {
      title: titleFromUrl ?? durable.title,
      version: durable.version,
    };
  }

  const assignment = await getAssignmentForSurvey(surveyId);
  if (!assignment?.latest_version) {
    throw new Error('No published version available for this survey');
  }

  cacheAssignment(surveyId, assignment);
  await persistAssignments([assignment]);

  return {
    title: titleFromUrl ?? assignment.survey_title,
    version: normalizeSurveyVersion(assignment.latest_version),
  };
}

export async function getLatestSurveyVersion(surveyId: number): Promise<SurveyVersion> {
  const { version } = await loadSurveyForFill(surveyId);
  return version;
}

export async function submitBatchResponses(
  batch: BatchResponseCreate
): Promise<{ results?: BatchResponseResult[]; status?: string }> {
  const response = await apiClient.post<{
    results?: BatchResponseResult[];
    status?: string;
  }>('/mobile/responses/batch', batch);
  return response.data;
}

export async function submitResponse(
  responseData: SurveyResponseCreate
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
  request: DocumentUploadRequest
): Promise<DocumentUploadResponse> {
  const response = await apiClient.post<DocumentUploadResponse>(
    '/mobile/documents/upload',
    request
  );
  return response.data;
}

export async function confirmFileUpload(
  request: DocumentConfirmRequest
): Promise<unknown> {
  const response = await apiClient.post<unknown>('/mobile/documents/confirm', request);
  return response.data;
}

export async function getMyResponses(): Promise<SurveyFormData[]> {
  const response = await apiClient.get<SurveyFormData[]>('/mobile/responses/me');
  return response.data;
}

export function buildSurveyResponseCreate(
  responseId: string,
  versionId: number,
  answers: Record<string, unknown>,
  questions: { id: number; question_key?: string }[],
  location: LocationData | null,
  metadata: ResponseMetadata
): SurveyResponseCreate {
  const now = new Date().toISOString();

  const answerEntries: QuestionAnswerCreate[] = questions
    .filter((q) => q.question_key !== undefined && answers[q.question_key] !== undefined)
    .map((q) => ({
      question_id: q.id,
      answer_value: answers[q.question_key as string],
      answered_at: now,
      answer_meta: {},
      media_url: null,
      evaluated_label: null,
    }));

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
    is_management: false,
  };
}
