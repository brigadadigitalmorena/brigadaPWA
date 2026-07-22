import apiClient from './client';
import {
  Assignment,
  SurveyVersion,
  SurveyFormData,
  LocationData,
  ResponseMetadata,
} from '@/lib/types';

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
 * Get my assigned surveys (mobile endpoint)
 * Uses /mobile/surveys which works for any authenticated user
 */
export async function getMyAssignments(): Promise<Assignment[]> {
  const response = await apiClient.get<Assignment[]>('/mobile/surveys');
  return response.data;
}

/**
 * Resolve survey title from mobile assignments (no admin permission required).
 */
export async function getSurveyTitle(surveyId: number): Promise<string> {
  const assignments = await getMyAssignments();
  const match = assignments.find((a) => a.survey_id === surveyId);
  return match?.survey_title ?? `Encuesta #${surveyId}`;
}

/**
 * Get latest published survey version
 */
export async function getLatestSurveyVersion(surveyId: number): Promise<SurveyVersion> {
  const response = await apiClient.get<SurveyVersion>(
    `/mobile/surveys/${surveyId}/latest`
  );
  return response.data;
}

/**
 * Submit a batch of responses.
 */
export async function submitBatchResponses(
  batch: BatchResponseCreate
): Promise<unknown> {
  const response = await apiClient.post<unknown>('/mobile/responses/batch', batch);
  return response.data;
}

/**
 * Submit a single response using the batch endpoint.
 */
export async function submitResponse(
  responseData: SurveyResponseCreate
): Promise<unknown> {
  return submitBatchResponses({ responses: [responseData] });
}

/**
 * Get presigned URL for file upload
 */
export async function getPresignedUploadUrl(
  request: DocumentUploadRequest
): Promise<DocumentUploadResponse> {
  const response = await apiClient.post<DocumentUploadResponse>(
    '/mobile/documents/upload',
    request
  );
  return response.data;
}

/**
 * Confirm file upload
 */
export async function confirmFileUpload(
  request: DocumentConfirmRequest
): Promise<unknown> {
  const response = await apiClient.post<unknown>('/mobile/documents/confirm', request);
  return response.data;
}

/**
 * Get my submitted responses
 */
export async function getMyResponses(): Promise<SurveyFormData[]> {
  const response = await apiClient.get<SurveyFormData[]>('/mobile/responses/me');
  return response.data;
}

/**
 * Build a SurveyResponseCreate payload from local response data.
 */
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
