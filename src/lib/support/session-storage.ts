import {
  normalizeSupportCapabilities,
  type SupportCapability,
} from '@/lib/support/access-policy';

export const SUPPORT_SESSION_STORAGE_KEY = 'brigada_support_session';

export interface StoredSupportSession {
  token: string;
  sessionId: string;
  helperName: string;
  creatorName: string;
  creatorUserId?: number | null;
  allowedCapabilities: SupportCapability[];
  surveyScopeKey?: string | null;
}

export function parseStoredSupportSession(
  raw: string | null | undefined
): StoredSupportSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSupportSession> & {
      allowed_capabilities?: unknown[];
    };
    if (
      typeof value.token !== 'string' ||
      !value.token ||
      typeof value.sessionId !== 'string' ||
      !value.sessionId ||
      typeof value.helperName !== 'string' ||
      typeof value.creatorName !== 'string'
    ) {
      return null;
    }
    return {
      token: value.token,
      sessionId: value.sessionId,
      helperName: value.helperName,
      creatorName: value.creatorName,
      creatorUserId: value.creatorUserId ?? null,
      allowedCapabilities: normalizeSupportCapabilities(
        value.allowedCapabilities ?? value.allowed_capabilities
      ),
      ...('surveyScopeKey' in value
        ? {
            surveyScopeKey:
              value.surveyScopeKey === null ||
              typeof value.surveyScopeKey === 'string'
                ? value.surveyScopeKey
                : null,
          }
        : {}),
    };
  } catch {
    return null;
  }
}

export function readSupportSession(): StoredSupportSession | null {
  if (typeof window === 'undefined') return null;
  return parseStoredSupportSession(
    localStorage.getItem(SUPPORT_SESSION_STORAGE_KEY)
  );
}

export function writeSupportSession(session: StoredSupportSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSupportSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
}

export function supportSurveyScopeKey(
  surveyIds: number[] | null | undefined
): string | null {
  if (!Array.isArray(surveyIds) || surveyIds.length === 0) return null;
  return [...surveyIds].sort((a, b) => a - b).join(',');
}
