/**
 * Prioritarias screen — selection and urgency helpers.
 * Includes survey_type extra (temporal) and rows with ends_at. Gestion surveys: /surveys.
 *
 * @see ai-context/walkthroughs/extras-selection.md
 */

export type PriorityUrgency = 'high' | 'medium' | 'low';

export interface PrioritySurveyRow {
  survey_type?: string | null;
  /** Legacy client-only flag; not emitted by the mobile API. */
  is_extra?: boolean;
  ends_at?: string | null;
  entitlement_status?: string;
}

/** extra and legacy extra aliases. Excludes normal and gestion surveys. */
export function isPrioritySurveyType(
  surveyType?: string | null,
  isExtra?: boolean,
): boolean {
  const type = (surveyType ?? '').toLowerCase();
  return type === 'extra' || type === 'extras' || Boolean(isExtra);
}

/** @deprecated Use isPrioritySurveyType */
export const isExtraSurveyType = isPrioritySurveyType;

/** True when the entitlement should appear on /extras (Prioritarias). */
export function isPriorityEntitlement(row: PrioritySurveyRow): boolean {
  if (
    row.entitlement_status === 'completed' ||
    row.entitlement_status === 'revoked'
  ) {
    return false;
  }
  if (isPrioritySurveyType(row.survey_type, row.is_extra)) {
    return true;
  }
  const type = (row.survey_type ?? '').toLowerCase();
  if (type === 'gestion') {
    return false;
  }
  return Boolean(row.ends_at?.trim());
}

export function filterPriorityEntitlements<T extends PrioritySurveyRow>(
  all: T[],
): T[] {
  return all.filter(isPriorityEntitlement);
}

/** @deprecated Use filterPriorityEntitlements */
export const filterExtraEntitlements = filterPriorityEntitlements;

export function resolvePriorityDisplayItems<T extends PrioritySurveyRow>(
  all: T[],
): T[] {
  return filterPriorityEntitlements(all);
}

/** @deprecated Use resolvePriorityDisplayItems */
export const resolveExtrasDisplayItems = resolvePriorityDisplayItems;

export function priorityUrgencyLevel(
  endsAt?: string | null,
  nowMs: number = Date.now(),
): PriorityUrgency {
  if (!endsAt) {
    return 'low';
  }
  const endMs = new Date(endsAt).getTime();
  if (Number.isNaN(endMs)) {
    return 'low';
  }
  const hours = (endMs - nowMs) / (1000 * 60 * 60);
  if (hours < 24) {
    return 'high';
  }
  if (hours < 72) {
    return 'medium';
  }
  return 'low';
}

/** @deprecated Use priorityUrgencyLevel */
export const extraUrgencyLevel = priorityUrgencyLevel;

export type ExtraUrgency = PriorityUrgency;
export type ExtraSurveyRow = PrioritySurveyRow;

export function priorityUrgencyLabel(level: PriorityUrgency): string {
  switch (level) {
    case 'high':
      return 'Urgente';
    case 'medium':
      return 'Pronto';
    default:
      return 'Normal';
  }
}

/** @deprecated Use priorityUrgencyLabel */
export const extraUrgencyLabel = priorityUrgencyLabel;

/** Badge copy from deadline urgency. */
export function prioritySurveyBadge(
  row: PrioritySurveyRow,
  nowMs: number = Date.now(),
): { level: PriorityUrgency; label: string } {
  const level = priorityUrgencyLevel(row.ends_at, nowMs);
  return { level, label: priorityUrgencyLabel(level) };
}
