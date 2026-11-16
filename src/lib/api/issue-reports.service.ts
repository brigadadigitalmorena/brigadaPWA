import apiClient from './client';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueSource = 'cms' | 'mobile' | 'pwa';

export interface IssueReportAttachmentUploadRequest {
  file_name: string;
  file_size: number;
  mime_type: string;
  file_client_id?: string;
}

export interface IssueReportAttachmentUploadResponse {
  id: number;
  document_id: string;
  upload_url: string;
  storage_key: string;
  expires_at: string;
  max_bytes: number;
  allowed_mime_types: string[];
}

export interface IssueReportAttachmentConfirmResponse {
  id: number;
  document_id: string;
  status: string;
}

export interface IssueReportCreateRequest {
  client_id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  source: IssueSource;
  platform?: string;
  app_version?: string;
  route_or_screen?: string;
  device_info?: Record<string, unknown>;
  context?: Record<string, unknown>;
  attachment_document_ids: number[];
}

export interface IssueReportCreateResponse {
  status: 'created' | 'duplicate';
  id?: number | null;
  report?: {
    id: number;
    client_id: string;
    title: string;
    description: string;
    severity: IssueSeverity;
    status: string;
    source: IssueSource;
    created_at: string;
  } | null;
}

function apiError(error: unknown, fallback: string): Error {
  if (!error || typeof error !== 'object') return new Error(fallback);
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return new Error(detail);
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  return new Error(fallback);
}

export async function requestIssueAttachmentUploadUrl(
  body: IssueReportAttachmentUploadRequest
): Promise<IssueReportAttachmentUploadResponse> {
  try {
    const { data } = await apiClient.post<IssueReportAttachmentUploadResponse>(
      '/issue-reports/attachments/upload-url',
      body
    );
    return data;
  } catch (error) {
    throw apiError(error, 'No se pudo preparar la subida de la captura');
  }
}

export async function confirmIssueAttachment(input: {
  document_id: string;
  storage_key?: string;
}): Promise<IssueReportAttachmentConfirmResponse> {
  try {
    const { data } = await apiClient.post<IssueReportAttachmentConfirmResponse>(
      '/issue-reports/attachments/confirm',
      input
    );
    return data;
  } catch (error) {
    throw apiError(error, 'No se pudo confirmar la captura subida');
  }
}

export async function createIssueReport(
  body: IssueReportCreateRequest
): Promise<IssueReportCreateResponse> {
  try {
    const { data } = await apiClient.post<IssueReportCreateResponse>(
      '/issue-reports',
      body
    );
    return data;
  } catch (error) {
    throw apiError(error, 'No se pudo enviar el reporte');
  }
}
