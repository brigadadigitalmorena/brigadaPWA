import { Question, SurveySection, SurveyVersion } from '@/lib/types';

const ASSIGNMENT_CACHE_PREFIX = 'brigada_survey_assignment_';

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function questionBelongsToSection(
  question: Question,
  section: SurveySection
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
    (question) => !assignedQuestionIds.has(question.id)
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

export function cacheAssignment(
  surveyId: number,
  assignment: { survey_id: number; survey_title: string; latest_version: SurveyVersion }
): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    `${ASSIGNMENT_CACHE_PREFIX}${surveyId}`,
    JSON.stringify(assignment)
  );
}

export function readCachedAssignment(
  surveyId: number
): { survey_id: number; survey_title: string; latest_version: SurveyVersion } | null {
  if (typeof window === 'undefined') return null;

  const raw = sessionStorage.getItem(`${ASSIGNMENT_CACHE_PREFIX}${surveyId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      survey_id: number;
      survey_title: string;
      latest_version: SurveyVersion;
    };
  } catch {
    return null;
  }
}

export function cacheAssignments(
  assignments: { survey_id: number; survey_title: string; latest_version: SurveyVersion }[]
): void {
  assignments.forEach((assignment) => {
    cacheAssignment(assignment.survey_id, assignment);
  });
}
