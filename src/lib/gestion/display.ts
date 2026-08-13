import type {
  GestionTrackingRow,
  ManagementStatus,
} from '@/lib/api/gestion.service';

export const MANAGEMENT_STATUSES: ManagementStatus[] = [
  'pendiente',
  'en_tramite',
  'resuelto',
  'problema',
];

export const DEFAULT_STATUS_LABELS: Record<ManagementStatus, string> = {
  pendiente: 'Pendiente',
  en_tramite: 'En trámite',
  resuelto: 'Resuelto',
  problema: 'Problema',
};

export const STATUS_BADGE_CLASSES: Record<ManagementStatus, string> = {
  pendiente:
    'border-muted-foreground/20 bg-muted text-muted-foreground',
  en_tramite:
    'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  resuelto:
    'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300',
  problema:
    'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
};

export function normalizeStatusLabels(
  labels?: Record<string, string>
): Record<ManagementStatus, string> {
  return MANAGEMENT_STATUSES.reduce(
    (result, status) => {
      result[status] = labels?.[status]?.trim() || DEFAULT_STATUS_LABELS[status];
      return result;
    },
    { ...DEFAULT_STATUS_LABELS }
  );
}

export function buildFolioDisplay(row: GestionTrackingRow): string {
  if (row.folio_seq > 0) return `Folio #${row.folio_seq}`;
  if (row.tracking_id?.trim()) return row.tracking_id.trim();
  return `Ref. ${row.request_id.slice(0, 8)}`;
}

const TECHNICAL_SOURCE_KEYS = new Set([
  '_uid',
  'id',
  'request_id',
  'tracking_id',
  'assignment_id',
  'survey_id',
]);

export function getSourceSummary(
  sourceValues: Record<string, string>,
  limit = 3
): string {
  return Object.entries(sourceValues ?? {})
    .filter(
      ([key, value]) =>
        !TECHNICAL_SOURCE_KEYS.has(key.toLowerCase()) &&
        String(value ?? '').trim().length > 0
    )
    .slice(0, limit)
    .map(([, value]) => String(value).trim())
    .join(' · ');
}

export function formatGestionDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatGestionDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
