import apiClient from './client';
import type { AppConfig } from '@/lib/types';

export type ManagementStatus =
  | 'pendiente'
  | 'en_tramite'
  | 'resuelto'
  | 'problema';

export interface GestionStatusHistoryEntry {
  from_status: ManagementStatus | null;
  to_status: ManagementStatus;
  changed_by_id: number | null;
  changed_by_name: string | null;
  note: string | null;
  changed_at: string;
}

export interface GestionTrackingRow {
  request_id: string;
  entitlement_id: number | null;
  campaign_id?: number | null;
  survey_id: number;
  survey_title: string;
  tracking_id: string;
  folio_seq: number;
  entitlement_status: string;
  inactive_reason?: string | null;
  management_status: ManagementStatus;
  comments: string;
  created_at: string;
  updated_at: string | null;
  closed_at: string | null;
  id_attributes: string[];
  source_values: Record<string, string>;
  status_history: GestionStatusHistoryEntry[];
}

export interface GestionComment {
  id: number;
  author_user_id: number | null;
  author_type: 'user' | 'admin';
  author_name: string | null;
  message: string;
  created_at: string;
}

export async function getGestionTrackingRows(): Promise<GestionTrackingRow[]> {
  const response = await apiClient.get<GestionTrackingRow[]>(
    '/mobile/gestiones/tracking'
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function getGestionComments(
  requestId: string
): Promise<GestionComment[]> {
  const response = await apiClient.get<GestionComment[]>(
    `/mobile/gestiones/requests/${encodeURIComponent(requestId)}/comments`
  );
  return Array.isArray(response.data) ? response.data : [];
}

export async function postGestionComment(
  requestId: string,
  message: string
): Promise<GestionComment> {
  const response = await apiClient.post<GestionComment>(
    `/mobile/gestiones/requests/${encodeURIComponent(requestId)}/comments`,
    { message }
  );
  return response.data;
}

export async function getManagementStatusLabels(): Promise<
  Record<string, string>
> {
  const response = await apiClient.get<AppConfig>('/public/app-config');
  return response.data.management_status_labels ?? {};
}
