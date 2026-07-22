import type { Question } from '@/lib/types';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';

export const AUTO_ADVANCE_TYPES = new Set([
  'yes_no',
  'single_choice',
  'select',
  'radio',
  'single_choice_image',
]);

export const SWIPE_BLOCKED_TYPES = new Set([
  'slider',
  'scale',
  'rating',
  'signature',
  'location',
  'gis_line',
  'gis_polygon',
  'gis_tracking_manual',
  'gis_tracking_auto',
  'photo_canvas',
]);

const NON_FILLABLE_TYPES = new Set(['read_only', 'data_list']);

const GROUP_CONTAINER_TYPES = new Set(['begin_group', 'begin_repeat']);

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isReadOnlyQuestion(question: Question): boolean {
  const rules = question.validation_rules ?? {};
  const ui = question.ui ?? {};
  const normalizedType = normalizeQuestionType(question.question_type);

  return (
    normalizedType === 'read_only' ||
    Boolean(question.calculated_expression) ||
    isTruthyFlag((question as Question & { read_only?: unknown }).read_only) ||
    isTruthyFlag(ui.read_only) ||
    isTruthyFlag(rules.read_only)
  );
}

export function isFillableQuestion(question: Question): boolean {
  const normalizedType = normalizeQuestionType(question.question_type);

  if (!normalizedType) return false;
  if (NON_FILLABLE_TYPES.has(normalizedType)) return false;
  if (isReadOnlyQuestion(question)) return false;

  const groupType = (question as Question & { group_type?: string | null }).group_type;
  if (groupType && GROUP_CONTAINER_TYPES.has(groupType)) return false;

  return true;
}

export function isAutoAdvanceType(type: string): boolean {
  return AUTO_ADVANCE_TYPES.has(normalizeQuestionType(type));
}

export function isSwipeBlockedType(type: string): boolean {
  return SWIPE_BLOCKED_TYPES.has(normalizeQuestionType(type));
}
