import { db } from '@/lib/db/database';
import { deleteResponseBlobs } from '@/lib/services/file-blob.service';

/**
 * Discard a local draft and cascade-clean related files / queue rows.
 * Mirrors mobile `offlineSyncService.deleteDraft` + responseRepository cascade.
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
  const fileIds = new Set(files.map((f) => f.file_id));

  await db.transaction(
    'rw',
    db.responses,
    db.local_files,
    db.file_blobs,
    db.sync_queue,
    async () => {
      const queueItems = await db.sync_queue
        .filter(
          (item) =>
            item.entity_id === responseId ||
            (item.entity_type === 'file' && fileIds.has(item.entity_id)) ||
            (item.operation_type === 'UPLOAD_FILE' && fileIds.has(item.entity_id)) ||
            (item.operation_type === 'CREATE_RESPONSE' &&
              item.entity_id === responseId)
        )
        .toArray();

      for (const item of queueItems) {
        if (item.id !== undefined) {
          await db.sync_queue.delete(item.id);
        }
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
