export interface DailyMetrics {
  completed_today: number;
  pending_sync: number;
  unread_comments: number;
}

export function mexicoDayKey(
  date: Date,
  timeZone = 'America/Mexico_City'
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function countCompletedToday(
  rows: Array<{
    sync_status: string;
    completed_at?: string | null;
    updated_at?: string | null;
  }>,
  now = new Date()
): number {
  const today = mexicoDayKey(now);
  return rows.filter((row) => {
    if (row.sync_status !== 'synced') return false;
    const value = row.completed_at ?? row.updated_at;
    if (!value) return false;
    const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
    const date = new Date(iso);
    return !Number.isNaN(date.getTime()) && mexicoDayKey(date) === today;
  }).length;
}

export function mergeDailyCounts(input: {
  localCompleted: number;
  localPending: number;
  remote: DailyMetrics | null;
}): { completed: number; pending: number; comments: number } {
  return {
    completed: Math.max(input.localCompleted, input.remote?.completed_today ?? 0),
    pending: Math.max(input.localPending, input.remote?.pending_sync ?? 0),
    comments: input.remote?.unread_comments ?? 0,
  };
}
