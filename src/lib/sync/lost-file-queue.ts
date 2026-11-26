/**
 * Uploads whose bytes are gone from the phone. Retrying cannot recover them,
 * and a new queue row must not be created for the same file.
 */

const LOST_FILE_CODES = new Set(['BLOB_MISSING', 'LOCAL_FILE_MISSING']);
const CLOSED_QUEUE_STATUSES = new Set(['completed', 'discarded', 'cancelled']);
const IN_FLIGHT_QUEUE_STATUSES = new Set(['leased', 'syncing']);

export interface LostFileQueueRow {
  id?: number;
  operation_type: string;
  entity_id: string;
  status: string;
  last_error?: string;
  last_error_code?: string;
}

export interface LostFileCollapsePlan {
  /** Queue row ids to mark discarded. The kept terminal row is not included. */
  discardIds: number[];
  /** file_id values whose local row must leave `pending` so recovery stops. */
  fileIds: string[];
}

export function isLostFileMessage(message: string): boolean {
  return (
    message.includes('No se pudo recuperar el archivo local') ||
    message.includes('Archivo local no encontrado')
  );
}

export function isLostFileQueueRow(row: {
  last_error_code?: string;
  last_error?: string;
}): boolean {
  if (row.last_error_code && LOST_FILE_CODES.has(row.last_error_code)) return true;
  return row.last_error ? isLostFileMessage(row.last_error) : false;
}

/** True when this pass confirmed nothing and every recorded error is a lost file. */
export function isLostFileOnlyRun(result: {
  succeeded: number;
  failed: number;
  errors: string[];
}): boolean {
  if (result.succeeded > 0 || result.failed === 0 || result.errors.length === 0) {
    return false;
  }
  return result.errors.every(isLostFileMessage);
}

/**
 * One terminal row per file that already failed because the bytes are gone.
 * Extra rows — including the pending copy recovery just inserted — are discarded.
 * A row leased by an in-flight pass is left alone so that pass can finish.
 */
export function planLostFileCollapse(rows: LostFileQueueRow[]): LostFileCollapsePlan {
  const groups = new Map<string, LostFileQueueRow[]>();

  for (const row of rows) {
    if (row.operation_type !== 'UPLOAD_FILE') continue;
    if (CLOSED_QUEUE_STATUSES.has(row.status)) continue;
    const list = groups.get(row.entity_id) ?? [];
    list.push(row);
    groups.set(row.entity_id, list);
  }

  const discardIds: number[] = [];
  const fileIds: string[] = [];

  for (const [fileId, group] of groups) {
    const lost = group.filter(
      (row) =>
        (row.status === 'failed_permanent' ||
          row.status === 'dead_letter' ||
          row.status === 'failed') &&
        isLostFileQueueRow(row)
    );
    if (lost.length === 0) continue;

    fileIds.push(fileId);
    const keeper = lost.reduce((best, row) =>
      (row.id ?? Number.POSITIVE_INFINITY) < (best.id ?? Number.POSITIVE_INFINITY) ? row : best
    );

    for (const row of group) {
      if (row.id === undefined || row.id === keeper.id) continue;
      if (IN_FLIGHT_QUEUE_STATUSES.has(row.status)) continue;
      discardIds.push(row.id);
    }
  }

  return { discardIds, fileIds };
}
