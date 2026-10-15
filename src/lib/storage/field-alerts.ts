const PENDING_CONFIRM = new Set([
  'pending',
  'retry_wait',
  'leased',
  'syncing',
]);

export function isLowStorage(usage: number, quota: number): boolean {
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) {
    return false;
  }
  const free = quota - usage;
  return usage / quota >= 0.9 || free < 50 * 1024 * 1024;
}

export function hasSchemaMismatch(
  items: Array<{ last_error_code?: string | null; status: string }>
): boolean {
  return items.some(
    (item) =>
      item.last_error_code === 'schema_mismatch' &&
      item.status !== 'discarded' &&
      item.status !== 'cancelled'
  );
}

export function countPendingConfirms(
  items: Array<{ operation_type: string; status: string }>
): number {
  return items.filter(
    (item) =>
      item.operation_type === 'CONFIRM_DOCUMENT' &&
      PENDING_CONFIRM.has(item.status)
  ).length;
}
