import { db } from '@/lib/db/database';

/**
 * Store a file blob in IndexedDB so it survives page reloads.
 */
export async function saveFileBlob(
  fileId: string,
  responseId: string,
  blob: Blob
): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction('rw', db.file_blobs, async () => {
    const existing = await db.file_blobs.where('file_id').equals(fileId).toArray();
    const [first, ...rest] = existing;
    if (first?.id !== undefined) {
      await db.file_blobs.update(first.id, {
        response_id: responseId,
        blob,
        created_at: now,
      });
      const extraIds = rest
        .map((row) => row.id)
        .filter((id): id is number => id !== undefined);
      if (extraIds.length > 0) {
        await db.file_blobs.bulkDelete(extraIds);
      }
      return;
    }

    await db.file_blobs.add({
      file_id: fileId,
      response_id: responseId,
      blob,
      created_at: now,
    });
  });
}

/**
 * Load a file blob from IndexedDB by file_id.
 * If older rows exist for the same id, the newest one that still has bytes wins.
 */
export async function loadFileBlob(fileId: string): Promise<Blob | null> {
  const records = await db.file_blobs.where('file_id').equals(fileId).toArray();
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const blob = records[index]?.blob;
    if (blob) return blob;
  }
  return null;
}

/**
 * Delete a file blob from IndexedDB.
 */
export async function deleteFileBlob(fileId: string): Promise<void> {
  await db.file_blobs.where('file_id').equals(fileId).delete();
}

/**
 * Delete all blobs for a response.
 */
export async function deleteResponseBlobs(responseId: string): Promise<void> {
  await db.file_blobs.where('response_id').equals(responseId).delete();
}
