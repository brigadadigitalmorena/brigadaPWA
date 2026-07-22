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

  await db.file_blobs.put({
    file_id: fileId,
    response_id: responseId,
    blob,
    created_at: now,
  });
}

/**
 * Load a file blob from IndexedDB by file_id.
 */
export async function loadFileBlob(fileId: string): Promise<Blob | null> {
  const record = await db.file_blobs.where('file_id').equals(fileId).first();
  return record?.blob || null;
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
