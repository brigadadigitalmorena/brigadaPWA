import { Question, SurveySection, SurveyVersion } from '@/lib/types';
import type { FieldTrackingConfig } from '@/lib/api/field-session.service';

const ENTITLEMENT_CACHE_PREFIX = 'brigada_survey_entitlement_';
const LEGACY_ASSIGNMENT_CACHE_PREFIX = 'brigada_survey_assignment_';

/**
 * Subset of `Assignment` that the fill flow caches in sessionStorage so a
 * survey can be opened offline.
 */
export interface CachedEntitlement {
  survey_id: number;
  survey_title: string;
  survey_type?: string;
  latest_version: SurveyVersion;
  campaign_id?: number;
  entitlement_id: number;
  geo_enforcement?: string | null;
  area_names?: string[];
  /** FIELD-TRACK-1 — route config, used by the requires-active-session gate. */
  field_tracking?: FieldTrackingConfig | null;
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function questionBelongsToSection(
  question: Question,
  section: SurveySection,
): boolean {
  if (question.section_id == null) return false;

  const sectionId = String(question.section_id);
  return (
    sectionId === section.section_key ||
    sectionId === String(section.id)
  );
}

/**
 * Nest flat API questions into sections for the section-based fill UI.
 */
export function normalizeSurveyVersion(version: SurveyVersion): SurveyVersion {
  const sections = sortByOrder(version.sections ?? []);
  const questions = sortByOrder(version.questions ?? []);

  const sectionsAlreadyNested =
    sections.length > 0 &&
    sections.some((section) => (section.questions?.length ?? 0) > 0);

  if (sectionsAlreadyNested) {
    return {
      ...version,
      sections: sections.map((section) => ({
        ...section,
        questions: sortByOrder(section.questions ?? []),
      })),
    };
  }

  if (sections.length === 0) {
    if (questions.length === 0) {
      return { ...version, sections: [] };
    }

    return {
      ...version,
      sections: [
        {
          id: 0,
          version_id: version.id,
          section_key: 'default',
          title: 'Encuesta',
          order: 0,
          questions,
        },
      ],
    };
  }

  const assignedQuestionIds = new Set<number>();
  const nestedSections = sections.map((section) => {
    const sectionQuestions = questions.filter((question) => {
      if (!questionBelongsToSection(question, section)) return false;
      assignedQuestionIds.add(question.id);
      return true;
    });

    return {
      ...section,
      questions: sortByOrder(sectionQuestions),
    };
  });

  const unassignedQuestions = questions.filter(
    (question) => !assignedQuestionIds.has(question.id),
  );

  if (unassignedQuestions.length > 0 && nestedSections.length > 0) {
    nestedSections[0] = {
      ...nestedSections[0],
      questions: sortByOrder([
        ...(nestedSections[0].questions ?? []),
        ...unassignedQuestions,
      ]),
    };
  }

  return {
    ...version,
    sections: nestedSections,
  };
}

function entitlementStorageKeys(
  surveyId: number,
  campaignId?: number | null,
): string[] {
  const keys = [`${ENTITLEMENT_CACHE_PREFIX}${surveyId}`];
  if (campaignId != null) {
    keys.unshift(`${ENTITLEMENT_CACHE_PREFIX}c${campaignId}`);
  }
  return keys;
}

function legacyAssignmentStorageKeys(
  surveyId: number,
  campaignId?: number | null,
): string[] {
  const keys = [`${LEGACY_ASSIGNMENT_CACHE_PREFIX}${surveyId}`];
  if (campaignId != null) {
    keys.unshift(`${LEGACY_ASSIGNMENT_CACHE_PREFIX}c${campaignId}`);
  }
  return keys;
}

function migrateLegacyEntitlementCache(
  surveyId: number,
  campaignId?: number | null,
): void {
  if (typeof window === 'undefined') return;

  for (const legacyKey of legacyAssignmentStorageKeys(surveyId, campaignId)) {
    const legacyValue = sessionStorage.getItem(legacyKey);
    if (!legacyValue) continue;

    const canonicalKey = legacyKey.replace(
      LEGACY_ASSIGNMENT_CACHE_PREFIX,
      ENTITLEMENT_CACHE_PREFIX,
    );
    if (!sessionStorage.getItem(canonicalKey)) {
      sessionStorage.setItem(canonicalKey, legacyValue);
    }
    sessionStorage.removeItem(legacyKey);
  }
}

export function cacheEntitlement(
  surveyId: number,
  entitlement: CachedEntitlement,
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    `${ENTITLEMENT_CACHE_PREFIX}${surveyId}`,
    JSON.stringify(entitlement),
  );
  if (entitlement.campaign_id != null) {
    sessionStorage.setItem(
      `${ENTITLEMENT_CACHE_PREFIX}c${entitlement.campaign_id}`,
      JSON.stringify(entitlement),
    );
  }
}

export function readCachedEntitlement(
  surveyId: number,
  campaignId?: number | null,
): CachedEntitlement | null {
  if (typeof window === 'undefined') return null;

  migrateLegacyEntitlementCache(surveyId, campaignId);

  for (const key of entitlementStorageKeys(surveyId, campaignId)) {
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw) as CachedEntitlement;
    } catch {
      /* try next key */
    }
  }

  return null;
}

export function cacheEntitlements(entitlements: CachedEntitlement[]): void {
  entitlements.forEach((entitlement) => {
    cacheEntitlement(entitlement.survey_id, entitlement);
  });
}
