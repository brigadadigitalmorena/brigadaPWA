import type { Assignment } from '@/lib/types';

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Current backend (`dev`) still emits assignment/group fields.
 * The PWA list/fill contract uses entitlement/campaign names.
 */
type LegacyAssignmentRow = {
  assignment_id?: unknown;
  assignment_status?: unknown;
  group_id?: unknown;
  group_name?: unknown;
};

export function unwrapAssignedSurveyList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of [
      'items',
      'data',
      'surveys',
      'entitlements',
      'assignments',
    ] as const) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export function normalizeAssignedSurvey(row: unknown): Assignment | null {
  if (!row || typeof row !== 'object') return null;
  const source = row as Partial<Assignment> &
    LegacyAssignmentRow &
    Record<string, unknown>;

  const surveyId = asFiniteNumber(source.survey_id);
  const entitlementId =
    asFiniteNumber(source.entitlement_id) ??
    asFiniteNumber(source.assignment_id);
  if (surveyId == null || entitlementId == null) return null;

  const campaignId =
    asFiniteNumber(source.campaign_id) ?? asFiniteNumber(source.group_id);
  const campaignName =
    asOptionalString(source.campaign_name) ??
    asOptionalString(source.group_name);
  const entitlementStatus =
    asOptionalString(source.entitlement_status) ??
    asOptionalString(source.assignment_status) ??
    'active';
  const surveyTitle =
    asOptionalString(source.survey_title) ?? `Encuesta #${surveyId}`;

  return {
    ...(source as Assignment),
    survey_id: surveyId,
    survey_title: surveyTitle,
    entitlement_id: entitlementId,
    entitlement_status: entitlementStatus,
    ...(campaignId != null ? { campaign_id: campaignId } : {}),
    ...(campaignName ? { campaign_name: campaignName } : {}),
  };
}

export function normalizeAssignedSurveys(payload: unknown): Assignment[] {
  return unwrapAssignedSurveyList(payload)
    .map(normalizeAssignedSurvey)
    .filter((row): row is Assignment => row != null);
}
