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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeGestionTrackingRow(row: unknown): GestionTrackingRow | null {
  if (!row || typeof row !== 'object') return null;
  const source = row as Partial<GestionTrackingRow> & {
    assignment_id?: unknown;
    assignment_status?: unknown;
  };
  if (typeof source.request_id !== 'string') return null;
  return {
    request_id: source.request_id,
    entitlement_id:
      asFiniteNumber(source.entitlement_id) ??
      asFiniteNumber(source.assignment_id),
    campaign_id: source.campaign_id ?? null,
    survey_id: Number(source.survey_id ?? 0),
    survey_title: source.survey_title || 'Gestión',
    tracking_id: source.tracking_id || source.request_id,
    folio_seq: Number(source.folio_seq ?? 0),
    entitlement_status:
      source.entitlement_status ||
      (typeof source.assignment_status === 'string'
        ? source.assignment_status
        : 'active'),
    inactive_reason: source.inactive_reason ?? null,
    management_status: source.management_status || 'pendiente',
    comments: source.comments || '',
    created_at: source.created_at || new Date(0).toISOString(),
    updated_at: source.updated_at ?? null,
    closed_at: source.closed_at ?? null,
    id_attributes: source.id_attributes ?? [],
    source_values: source.source_values ?? {},
    status_history: source.status_history ?? [],
  };
}

export async function getGestionTrackingRows(): Promise<GestionTrackingRow[]> {
  const response = await apiClient.get<unknown>('/mobile/gestiones/tracking');
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows
    .map(normalizeGestionTrackingRow)
    .filter((row): row is GestionTrackingRow => row != null);
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
