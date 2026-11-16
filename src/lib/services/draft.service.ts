import { db, type Response } from '@/lib/db/database';
import { isEmptyAnswerValue } from '@/lib/forms/validate-answer';
import { deleteResponseBlobs } from '@/lib/services/file-blob.service';

/**
 * True when a draft has at least one non-empty answer or attached file.
 * Used so opening a survey (autosave on hydrate) does not leave a phantom
 * "borrador pendiente" banner until the user actually captures data.
 */
export function answersHaveContent(
  answers: Record<string, unknown> | null | undefined
): boolean {
  if (!answers) return false;
  return Object.values(answers).some((value) => !isEmptyAnswerValue(value));
}

export function filesHaveContent(
  files: Record<string, unknown[] | undefined> | null | undefined
): boolean {
  if (!files) return false;
  return Object.values(files).some((list) => Array.isArray(list) && list.length > 0);
}

export function draftPayloadHasContent(
  answers: Record<string, unknown> | null | undefined,
  files: Record<string, unknown[] | undefined> | null | undefined
): boolean {
  return answersHaveContent(answers) || filesHaveContent(files);
}

export function draftRowHasContent(row: Pick<Response, 'answers_json'>): boolean {
  try {
    const parsed = JSON.parse(row.answers_json || '{}') as Record<string, unknown>;
    return answersHaveContent(parsed);
  } catch {
    return false;
  }
}

/**
 * Discard a local draft and cascade-clean related files / queue rows.
 * Mirrors mobile `offlineSyncService.deleteDraft` + responseRepository cascade.
 * Indexed lookups only: a full-table filter inside the write transaction can
 * stall while a sync is also using the queue.
 */
export async function deleteDraft(responseId: string): Promise<boolean> {
  const response = await db.responses
    .where('response_id')
    .equals(responseId)
    .first();

  if (!response) return false;
  if (response.status !== 'draft' || response.sync_status === 'synced') {
    return false;
  }

  const files = await db.local_files
    .where('response_id')
    .equals(responseId)
    .toArray();
  const entityIds = [responseId, ...files.map((file) => file.file_id)];
  const queueGroups = await Promise.all(
    entityIds.map((entityId) => db.sync_queue.where('entity_id').equals(entityId).toArray())
  );
  const queueIds = queueGroups
    .flat()
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined);

  await db.transaction(
    'rw',
    db.responses,
    db.local_files,
    db.file_blobs,
    db.sync_queue,
    async () => {
      if (queueIds.length > 0) {
        await db.sync_queue.bulkDelete(queueIds);
      }
      await db.local_files.where('response_id').equals(responseId).delete();
      await db.file_blobs.where('response_id').equals(responseId).delete();
      if (response.id !== undefined) {
        await db.responses.delete(response.id);
      }
    }
  );

  await deleteResponseBlobs(responseId).catch(() => undefined);
  return true;
}

/**
 * Remove empty draft shells left by hydrate autosave / abandoned opens.
 * Files alone count as content; banner cleanup drops drafts with neither.
 */
export async function purgeEmptyDrafts(): Promise<number> {
  const drafts = await db.responses.where('status').equals('draft').toArray();
  let removed = 0;

  for (const draft of drafts) {
    if (draftRowHasContent(draft)) continue;

    const fileCount = await db.local_files
      .where('response_id')
      .equals(draft.response_id)
      .count();
    if (fileCount > 0) continue;

    const deleted = await deleteDraft(draft.response_id);
    if (deleted) removed += 1;
  }

  return removed;
}

export async function reopenForCorrection(
  queueId: string,
  responseId: string
): Promise<{ surveyId: string } | null> {
  const response = await db.responses
    .where('response_id')
    .equals(responseId)
    .first();
  if (!response) return null;
  if (response.sync_status === 'synced') return null;

  await db.transaction('rw', db.responses, db.sync_queue, async () => {
    const existing = await db.responses
      .where('response_id')
      .equals(responseId)
      .first();
    if (!existing || existing.id === undefined) return;

    await db.responses.update(existing.id, {
      status: 'draft',
      sync_status: 'pending',
      completed_at: undefined,
      immutable: false,
      sync_error: 'Corrección pendiente',
      updated_at: new Date().toISOString(),
    });

    const queueItem = await db.sync_queue.where('queue_id').equals(queueId).first();
    if (
      queueItem?.id !== undefined &&
      (queueItem.status === 'dead_letter' || queueItem.status === 'failed_permanent')
    ) {
      await db.sync_queue.delete(queueItem.id);
    }
  });

  return { surveyId: response.survey_id };
}
