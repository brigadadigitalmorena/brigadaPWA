import type { FieldSession } from '@/lib/db/database';

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDistance(value: number): string {
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} km`
    : `${Math.round(value)} m`;
}

export function formatDuration(startedAt: string, endedAt?: string): string {
  const elapsed =
    new Date(endedAt ?? new Date().toISOString()).getTime() -
    new Date(startedAt).getTime();
  const minutes = Math.max(0, Math.round(elapsed / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

export function recorridoStatusLabel(status: FieldSession['status']): string {
  if (status === 'active') return 'Activo';
  if (status === 'abandoned') return 'Abandonado';
  return 'Finalizado';
}

export function recorridoSearchText(session: FieldSession): string {
  const started = new Date(session.started_at);
  const dateLong = started.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const dateNumeric = started.toLocaleDateString('es-MX');
  const time = started.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const syncLabel = session.server_id ? 'Sincronizado' : 'Local';

  return [
    dateLong,
    dateNumeric,
    time,
    started.toISOString().slice(0, 10),
    recorridoStatusLabel(session.status),
    session.status,
    formatDuration(session.started_at, session.ended_at),
    formatDistance(session.distance_m),
    `${session.sample_count} pts`,
    `${session.sample_count} puntos`,
    syncLabel,
    session.activity_type,
    session.client_id,
  ]
    .filter(Boolean)
    .join(' ');
}

export function matchesRecorridoQuery(
  session: FieldSession,
  query: string
): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return normalizeSearch(recorridoSearchText(session)).includes(needle);
}
