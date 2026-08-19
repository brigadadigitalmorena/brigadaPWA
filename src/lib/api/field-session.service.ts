/**
 * FIELD-TRACK-1 — route session endpoints.
 *
 * Every call is idempotent server-side (sessions upsert by `client_id`,
 * samples by `sample_seq`), so the sync queue can replay them freely.
 */
import apiClient from './client';

export interface FieldTrackingGpsConfig {
  interval_s: number;
  distance_filter_m: number;
  desired_accuracy: 'high' | 'balanced' | 'low';
  max_accuracy_m: number;
}

export interface FieldTrackingConfig {
  enabled: boolean;
  activity_type: string;
  requires_active_session: 'block' | 'warn' | 'off';
  gps: FieldTrackingGpsConfig;
  photo: { enabled: boolean; interval_min: number };
  session: {
    max_duration_min: number;
    idle_timeout_min: number;
    min_battery_pct: number;
  };
}

export const DEFAULT_FIELD_TRACKING: FieldTrackingConfig = {
  enabled: false,
  activity_type: 'propaganda',
  requires_active_session: 'warn',
  gps: {
    interval_s: 60,
    distance_filter_m: 25,
    desired_accuracy: 'balanced',
    max_accuracy_m: 100,
  },
  photo: { enabled: false, interval_min: 15 },
  session: { max_duration_min: 480, idle_timeout_min: 30, min_battery_pct: 15 },
};

export interface FieldSessionStartPayload {
  client_id: string;
  activity_type: string;
  survey_id?: number | null;
  campaign_id?: number | null;
  entitlement_id?: number | null;
  started_at: string;
  config_snapshot?: Record<string, unknown> | null;
  device_info?: Record<string, unknown> | null;
  source?: 'android' | 'ios' | 'pwa';
  degraded_reason?: string | null;
}

export interface FieldSessionUpdatePayload {
  status?: 'active' | 'completed' | 'abandoned' | 'expired';
  ended_at?: string | null;
  end_reason?: string | null;
  degraded_reason?: string | null;
}

export interface FieldSampleUpload {
  sample_seq: number;
  sample_type: 'gps' | 'photo' | 'gap';
  recorded_at: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  altitude_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  provider?: string | null;
  app_state?: 'foreground' | 'background' | 'hidden' | null;
  is_mocked?: boolean;
  battery_pct?: number | null;
  media_file_id?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface FieldSessionRead {
  id: number;
  client_id: string;
  user_id: number;
  activity_type: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  sample_count: number;
  response_count: number;
  distance_m: number;
}

export interface FieldSampleBatchResult {
  accepted: number;
  duplicates: number;
  rejected: number;
  rejected_seqs: number[];
  session_sample_count: number;
  session_distance_m: number;
}

export interface FieldSessionHistoryItem {
  id: number;
  client_id: string;
  activity_type: string;
  survey_id?: number | null;
  survey_title?: string | null;
  status: string;
  started_at: string;
  ended_at?: string | null;
  end_reason?: string | null;
  degraded_reason?: string | null;
  source?: string | null;
  duration_s?: number | null;
  distance_m: number;
  sample_count: number;
  response_count: number;
}

export interface FieldSessionHistoryResponse {
  items: FieldSessionHistoryItem[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export interface FieldSessionTrackResponse {
  session: FieldSessionHistoryItem;
  line?: { type: 'LineString'; coordinates: [number, number][] } | null;
  points: Array<{
    seq: number;
    lat: number;
    lng: number;
    recorded_at: string;
    accuracy_m?: number | null;
    speed_mps?: number | null;
    app_state?: string | null;
    is_mocked: boolean;
    sample_type: string;
    media_url?: string | null;
  }>;
  gaps: Array<{
    from_seq: number;
    to_seq: number;
    started_at: string;
    ended_at: string;
    duration_s: number;
    distance_m: number;
    reason?: string | null;
  }>;
  responses: Array<{
    response_id: number;
    client_id: string;
    completed_at: string;
    survey_title?: string | null;
    lat?: number | null;
    lng?: number | null;
  }>;
  stats: {
    distance_m: number;
    duration_s: number;
    sample_count: number;
    response_count: number;
    avg_accuracy_m?: number | null;
    max_accuracy_m?: number | null;
    gap_count: number;
    gap_duration_s: number;
    mocked_count: number;
    background_ratio?: number | null;
  };
}

export async function startFieldSession(
  payload: FieldSessionStartPayload
): Promise<FieldSessionRead> {
  const response = await apiClient.post<FieldSessionRead>(
    '/mobile/field-sessions',
    payload
  );
  return response.data;
}

export async function listMyFieldSessions(
  skip = 0,
  limit = 50
): Promise<FieldSessionHistoryResponse> {
  const response = await apiClient.get<FieldSessionHistoryResponse>(
    '/mobile/field-sessions',
    { params: { skip, limit } }
  );
  return response.data;
}

export async function getMyFieldSessionTrack(
  clientId: string
): Promise<FieldSessionTrackResponse> {
  const response = await apiClient.get<FieldSessionTrackResponse>(
    `/mobile/field-sessions/${clientId}/track`
  );
  return response.data;
}

export async function updateFieldSession(
  clientId: string,
  payload: FieldSessionUpdatePayload
): Promise<FieldSessionRead> {
  const response = await apiClient.patch<FieldSessionRead>(
    `/mobile/field-sessions/${clientId}`,
    payload
  );
  return response.data;
}

export async function uploadFieldSessionSamples(
  clientId: string,
  samples: FieldSampleUpload[]
): Promise<FieldSampleBatchResult> {
  const response = await apiClient.post<FieldSampleBatchResult>(
    `/mobile/field-sessions/${clientId}/samples`,
    { samples }
  );
  return response.data;
}
