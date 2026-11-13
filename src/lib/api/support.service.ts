import apiClient from './client';
import type { SupportCapability } from '@/lib/support/access-policy';

export interface SupportSession {
  session_id: string;
  helper_name: string;
  status: 'pending' | 'active' | 'revoked' | 'expired' | string;
  joined_at: string | null;
  expires_at: string;
  survey_count: number;
  is_active: boolean;
  survey_ids?: number[] | null;
  allowed_capabilities: SupportCapability[];
}

export interface SupportSessionListResponse {
  sessions: SupportSession[];
  max_sessions: number;
  active_count: number;
}

export interface CreateSupportSessionResponse {
  session_id: string;
  helper_name: string;
  access_code: string;
  expires_at: string;
  qr_data: string;
  allowed_capabilities: SupportCapability[];
  device_bound?: boolean;
  status?: string;
}

export interface JoinSupportSessionResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  creator_name: string;
  helper_name: string;
  session_id: string;
  creator_user_id?: number | null;
  survey_ids?: number[];
  allowed_capabilities?: string[];
}

export interface SupportStatsResponse {
  total_responses: number;
  helpers: Array<{
    session_id: string;
    helper_name: string;
    responses_collected: number;
    is_active: boolean;
  }>;
}

function apiError(error: unknown, fallback: string): Error {
  if (!error || typeof error !== 'object') return new Error(fallback);
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return new Error(detail);
  return new Error(fallback);
}

export async function createSupportSession(
  helperName: string,
  surveyIds?: number[] | null,
  allowedCapabilities: SupportCapability[] = []
): Promise<CreateSupportSessionResponse> {
  try {
    const { data } = await apiClient.post<CreateSupportSessionResponse>(
      '/mobile/support/create',
      {
        helper_name: helperName,
        survey_ids: surveyIds ?? null,
        allowed_capabilities: allowedCapabilities,
      }
    );
    return data;
  } catch (error) {
    throw apiError(error, 'Error al crear sesión de apoyo');
  }
}

export async function listSupportSessions(): Promise<SupportSessionListResponse> {
  try {
    const { data } = await apiClient.get<SupportSessionListResponse>(
      '/mobile/support/list'
    );
    return data;
  } catch (error) {
    throw apiError(error, 'Error al listar sesiones de apoyo');
  }
}

export async function revokeSupportSession(sessionId: string): Promise<void> {
  try {
    await apiClient.delete(`/mobile/support/${sessionId}`);
  } catch (error) {
    throw apiError(error, 'Error al revocar sesión de apoyo');
  }
}

export async function duplicateSupportSession(
  sessionId: string,
  helperName: string,
  allowedCapabilities?: SupportCapability[]
): Promise<CreateSupportSessionResponse> {
  try {
    const { data } = await apiClient.post<CreateSupportSessionResponse>(
      `/mobile/support/${sessionId}/duplicate`,
      {
        helper_name: helperName,
        ...(allowedCapabilities
          ? { allowed_capabilities: allowedCapabilities }
          : {}),
      }
    );
    return data;
  } catch (error) {
    throw apiError(error, 'Error al duplicar helper');
  }
}

export async function getSupportCredentials(
  sessionId: string
): Promise<CreateSupportSessionResponse> {
  try {
    const { data } = await apiClient.get<CreateSupportSessionResponse>(
      `/mobile/support/${sessionId}/credentials`
    );
    return data;
  } catch (error) {
    throw apiError(error, 'No se pudo mostrar el código');
  }
}

export async function reactivateSupportSession(
  sessionId: string
): Promise<CreateSupportSessionResponse> {
  try {
    const { data } = await apiClient.post<CreateSupportSessionResponse>(
      `/mobile/support/${sessionId}/reactivate`
    );
    return data;
  } catch (error) {
    throw apiError(error, 'No se pudo volver a autorizar el apoyo');
  }
}

export async function dismissSupportSession(sessionId: string): Promise<void> {
  try {
    await apiClient.post(`/mobile/support/${sessionId}/dismiss`);
  } catch (error) {
    throw apiError(error, 'No se pudo quitar la tarjeta');
  }
}

export async function updateSupportSessionCapabilities(
  sessionId: string,
  allowedCapabilities: SupportCapability[]
): Promise<void> {
  try {
    await apiClient.put(`/mobile/support/${sessionId}/capabilities`, {
      allowed_capabilities: allowedCapabilities,
    });
  } catch (error) {
    throw apiError(error, 'Error al actualizar accesos');
  }
}

export async function updateSupportSessionSurveys(
  sessionId: string,
  surveyIds: number[] | null
): Promise<void> {
  try {
    await apiClient.put(`/mobile/support/${sessionId}/surveys`, {
      survey_ids: surveyIds,
    });
  } catch (error) {
    throw apiError(error, 'Error al actualizar encuestas');
  }
}

export async function getSupportStats(): Promise<SupportStatsResponse> {
  try {
    const { data } = await apiClient.get<SupportStatsResponse>(
      '/mobile/support/stats'
    );
    return data;
  } catch (error) {
    throw apiError(error, 'Error al obtener estadísticas');
  }
}

export async function joinSupportSession(
  accessCode: string,
  deviceId: string,
  deviceInfo?: Record<string, unknown>
): Promise<JoinSupportSessionResponse> {
  try {
    const { data } = await apiClient.post<JoinSupportSessionResponse>(
      '/mobile/support/public/join',
      {
        access_code: accessCode,
        device_id: deviceId,
        device_info: deviceInfo ?? null,
      }
    );
    return data;
  } catch (error) {
    throw apiError(error, 'Error al unirse como helper');
  }
}

export async function releaseSupportSession(): Promise<void> {
  try {
    await apiClient.post('/mobile/support/public/release');
  } catch {
    // Best-effort: local logout must still proceed.
  }
}
