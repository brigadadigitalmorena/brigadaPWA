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
    'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  en_tramite:
    'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  resuelto:
    'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300',
  problema:
    'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
};

export const STATUS_LEFT_BORDER: Record<ManagementStatus, string> = {
  pendiente: 'border-l-amber-500',
  en_tramite: 'border-l-amber-500',
  resuelto: 'border-l-green-600',
  problema: 'border-l-red-500',
};

export const STATUS_SELECTED_CLASSES: Record<ManagementStatus, string> = {
  pendiente:
    'ring-2 ring-amber-500/45 bg-amber-50/70 dark:bg-amber-950/25',
  en_tramite:
    'ring-2 ring-amber-500/45 bg-amber-50/70 dark:bg-amber-950/25',
  resuelto:
    'ring-2 ring-green-600/40 bg-green-50/70 dark:bg-green-950/20',
  problema: 'ring-2 ring-red-500/40 bg-red-50/70 dark:bg-red-950/20',
};

/** Chip colors for GestionMetrics filter pills (not 1:1 with ManagementStatus). */
export const METRIC_CHIP_CLASSES: Record<
  'all' | 'proceso' | 'resuelto' | 'problema',
  { idle: string; active: string; icon: string; value: string }
> = {
  all: {
    idle: 'border-border hover:bg-muted/60',
    active: 'border-primary bg-primary/5',
    icon: 'text-primary',
    value: 'text-foreground',
  },
  proceso: {
    idle: 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10',
    active: 'border-amber-500/50 bg-amber-500/15',
    icon: 'text-amber-700 dark:text-amber-300',
    value: 'text-amber-800 dark:text-amber-200',
  },
  resuelto: {
    idle: 'border-green-500/20 bg-green-500/5 hover:bg-green-500/10',
    active: 'border-green-500/50 bg-green-500/15',
    icon: 'text-green-700 dark:text-green-300',
    value: 'text-green-800 dark:text-green-200',
  },
  problema: {
    idle: 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10',
    active: 'border-red-500/50 bg-red-500/15',
    icon: 'text-red-700 dark:text-red-300',
    value: 'text-red-800 dark:text-red-200',
  },
};

const SOURCE_KEY_LABELS: Record<string, string> = {
  survey_id: 'ID de encuesta',
  response_id: 'ID de respuesta',
  survey_title: 'Encuesta',
  completed_at: 'Completada',
  nombre_solicitante: 'Solicitante',
  folio_externo: 'Folio externo',
};

const TECHNICAL_SOURCE_KEYS = new Set([
  '_uid',
  'id',
  'request_id',
  'tracking_id',
  'campaign_id',
  'entitlement_id',
]);

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

export function humanizeSourceKey(key: string): string {
  const mapped = SOURCE_KEY_LABELS[key.toLowerCase()];
  if (mapped) return mapped;
  const spaced = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface SourceEntry {
  key: string;
  label: string;
  value: string;
}

function formatSourceValue(key: string, raw: string): string {
  if (key.toLowerCase().endsWith('_at') || key.toLowerCase().includes('date')) {
    const formatted = formatGestionDate(raw);
    if (formatted !== '—') return formatted;
  }
  return raw.trim();
}

export function getSourceEntries(
  sourceValues: Record<string, string> | undefined,
  options?: { idAttributes?: string[]; limit?: number }
): SourceEntry[] {
  const entries = Object.entries(sourceValues ?? {})
    .filter(
      ([key, value]) =>
        !TECHNICAL_SOURCE_KEYS.has(key.toLowerCase()) &&
        String(value ?? '').trim().length > 0
    )
    .map(([key, value]) => ({
      key,
      label: humanizeSourceKey(key),
      value: formatSourceValue(key, String(value)),
    }));

  const preferred = (options?.idAttributes ?? []).map((key) => key.toLowerCase());
  entries.sort((a, b) => {
    const aIdx = preferred.indexOf(a.key.toLowerCase());
    const bIdx = preferred.indexOf(b.key.toLowerCase());
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  return typeof options?.limit === 'number'
    ? entries.slice(0, options.limit)
    : entries;
}

export function getSourceSummary(
  sourceValues: Record<string, string>,
  limit = 3
): string {
  return getSourceEntries(sourceValues, { limit })
    .map((entry) => `${entry.label}: ${entry.value}`)
    .join(' · ');
}

export function getGestionReferenceFields(
  row: GestionTrackingRow
): Array<{ label: string; value: string }> {
  const tracking = row.tracking_id?.trim() ?? '';
  const reference = row.request_id?.trim() ?? '';
  if (tracking && reference && tracking === reference) {
    return [{ label: 'Referencia', value: reference }];
  }
  const fields: Array<{ label: string; value: string }> = [];
  if (tracking) fields.push({ label: 'Tracking ID', value: tracking });
  if (reference) fields.push({ label: 'Referencia', value: reference });
  return fields;
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
