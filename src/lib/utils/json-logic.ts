import jsonLogic from 'json-logic-js';

/**
 * Evaluate a JSON Logic expression against the provided data context.
 * Returns the raw result (could be boolean, number, string, etc.).
 */
export function evaluateLogic(
  expression: string | undefined | null,
  data: Record<string, unknown>
): unknown {
  if (!expression) return true;

  try {
    const parsed = JSON.parse(expression);
    return jsonLogic.apply(parsed, data);
  } catch (error) {
    console.warn('Failed to evaluate logic expression:', expression, error);
    return true;
  }
}

/**
 * Evaluate a relevance expression.
 * Returns true if the question/section should be visible.
 */
export function isRelevant(
  expression: string | undefined | null,
  answers: Record<string, unknown>
): boolean {
  const result = evaluateLogic(expression, answers);
  return Boolean(result);
}

/**
 * Evaluate a constraint expression for validation.
 * Returns true if the value passes the constraint.
 */
export function passesConstraint(
  expression: string | undefined | null,
  answers: Record<string, unknown>
): boolean {
  const result = evaluateLogic(expression, answers);
  return Boolean(result);
}
