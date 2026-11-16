import {
  evaluateJsonLogicExpression,
  evaluateJsonLogicAsBool,
} from '@/lib/forms/jsonlogic';

/**
 * Evaluate a JSON Logic expression against the provided data context.
 * Accepts a JSON string (legacy PWA) or an already-parsed object (Form Engine v2).
 */
export function evaluateLogic(
  expression: string | Record<string, unknown> | undefined | null,
  data: Record<string, unknown>,
  dataLists: Record<string, unknown> = {}
): unknown {
  if (!expression) return true;

  try {
    const parsed =
      typeof expression === 'string' ? (JSON.parse(expression) as Record<string, unknown>) : expression;
    return evaluateJsonLogicExpression(parsed, { answers: data, data_lists: dataLists });
  } catch (error) {
    console.warn('Failed to evaluate logic expression:', expression, error);
    return true;
  }
}

export function isRelevant(
  expression: string | Record<string, unknown> | undefined | null,
  answers: Record<string, unknown>,
  dataLists: Record<string, unknown> = {}
): boolean {
  if (!expression) return true;
  try {
    const parsed =
      typeof expression === 'string' ? (JSON.parse(expression) as Record<string, unknown>) : expression;
    return evaluateJsonLogicAsBool(parsed, { answers, data_lists: dataLists });
  } catch {
    return Boolean(evaluateLogic(expression, answers, dataLists));
  }
}

export function passesConstraint(
  expression: string | Record<string, unknown> | undefined | null,
  answers: Record<string, unknown>,
  dataLists: Record<string, unknown> = {}
): boolean {
  return Boolean(evaluateLogic(expression, answers, dataLists));
}
