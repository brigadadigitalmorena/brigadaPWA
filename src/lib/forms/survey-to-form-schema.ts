import type { Question, SurveyVersion } from '@/lib/types';
import type {
  FormSchemaFieldResponse,
  FormSchemaResponse,
  FormSchemaSectionResponse,
} from '@/lib/forms/schema-types';

function parseMaybeJson(
  value: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function questionToField(question: Question): FormSchemaFieldResponse {
  return {
    question_id: question.id,
    question_key: question.question_key ?? null,
    type: question.question_type,
    label: question.question_text,
    required: question.is_required,
    relevance: parseMaybeJson(question.relevance_expression),
    constraint: parseMaybeJson(question.constraint_expression),
    calculated: parseMaybeJson(question.calculated_expression),
    default_expression: parseMaybeJson(question.default_value_expression),
    appearance: question.appearance ?? null,
    ui: (question.ui as Record<string, unknown> | undefined) ?? null,
    options: (question.options ?? []).map((opt) => ({
      value: opt.option_text,
      label: opt.option_text,
      order: opt.order,
      id: opt.id,
    })),
    dataset_ref: question.dataset_ref ?? null,
    validation_rules: (question.validation_rules as Record<string, unknown> | undefined) ?? null,
  };
}

/**
 * Adapt a PWA SurveyVersion into Form Engine v2 schema.
 */
export function surveyVersionToFormSchema(version: SurveyVersion): FormSchemaResponse {
  const sections: FormSchemaSectionResponse[] = (version.sections ?? []).map((section) => ({
    key: section.section_key,
    title: section.title,
    description: section.description ?? null,
    relevance: parseMaybeJson(section.relevance_expression),
    fields: (section.questions ?? []).map(questionToField),
  }));

  // Flat questions without sections
  if (sections.length === 0 && version.questions?.length) {
    sections.push({
      key: 'default',
      title: 'Encuesta',
      fields: version.questions.map(questionToField),
    });
  }

  return {
    version: String(version.version_number),
    schema_version: version.schema_version ?? 1,
    engine: 'brigada',
    engine_version: version.engine_version ?? 2,
    settings: {},
    sections,
    data_lists: version.data_lists,
  };
}
