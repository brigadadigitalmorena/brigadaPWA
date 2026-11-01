/**
 * Drop answers whose questions are hidden by the form engine.
 * Keys follow both the engine (`question_key` or `q:{id}`) and the fill
 * store (`question_key` or the numeric id).
 */
export function visibleAnswerKeySet(
  fields: Array<{
    key: string;
    field: { question_id: number; question_key?: string | null };
  }>
): Set<string> {
  const keys = new Set<string>();
  for (const item of fields) {
    keys.add(item.key);
    if (item.field.question_key) keys.add(item.field.question_key);
    keys.add(String(item.field.question_id));
    keys.add(`q:${item.field.question_id}`);
  }
  return keys;
}

export function pruneHiddenAnswers<T>(
  answers: Record<string, T>,
  visibleKeys: ReadonlySet<string>
): Record<string, T> {
  const kept: Record<string, T> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (visibleKeys.has(key)) kept[key] = value;
  }
  return kept;
}
