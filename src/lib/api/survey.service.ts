import apiClient from './client';
import { Assignment, SurveyMetadata, SurveyVersion } from '@/lib/types';

/**
 * Get my assignments
 */
export async function getMyAssignments(): Promise<Assignment[]> {
  const response = await apiClient.get<Assignment[]>('/assignments/me');
  return response.data;
}

/**
 * Get survey metadata
 */
export async function getSurveyMetadata(surveyId: number): Promise<SurveyMetadata> {
  const response = await apiClient.get<SurveyMetadata>(`/admin/surveys/${surveyId}`);
  return response.data;
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
 * Submit survey response
 */
export async function submitResponse(responseData: any): Promise<any> {
  const response = await apiClient.post('/mobile/responses', responseData);
  return response.data;
}

/**
 * Submit batch of responses
 */
export async function submitBatchResponses(responses: any[]): Promise<any> {
  const response = await apiClient.post('/mobile/responses/batch', {
    responses,
  });
  return response.data;
}

/**
 * Get presigned URL for file upload
 */
export async function getPresignedUploadUrl(
  responseId: string,
  questionId: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ presigned_url: string; document_id: string }> {
  const response = await apiClient.post('/mobile/documents/upload', {
    response_id: responseId,
    question_id: questionId,
    file_name: fileName,
    file_type: fileType,
    file_size: fileSize,
  });
  return response.data;
}

/**
 * Confirm file upload
 */
export async function confirmFileUpload(
  documentId: string,
  storageKey: string
): Promise<void> {
  await apiClient.post('/mobile/documents/confirm', {
    document_id: documentId,
    storage_key: storageKey,
  });
}

/**
 * Get my submitted responses
 */
export async function getMyResponses(): Promise<any[]> {
  const response = await apiClient.get('/mobile/responses/me');
  return response.data;
}
