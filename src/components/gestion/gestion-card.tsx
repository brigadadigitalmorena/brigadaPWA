import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
} from 'lucide-react';
import type {
  GestionTrackingRow,
  ManagementStatus,
} from '@/lib/api/gestion.service';
import {
  buildFolioDisplay,
  formatGestionDate,
  getSourceEntries,
  STATUS_BADGE_CLASSES,
  STATUS_LEFT_BORDER,
  STATUS_SELECTED_CLASSES,
} from '@/lib/gestion/display';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GestionCardProps {
  row: GestionTrackingRow;
  selected: boolean;
  statusLabels: Record<ManagementStatus, string>;
  onSelect: () => void;
  mobileDetail?: React.ReactNode;
}

const STEPS: Array<{
  key: Exclude<ManagementStatus, 'problema'>;
  label: string;
}> = [
  { key: 'pendiente', label: 'Recibida' },
  { key: 'en_tramite', label: 'En proceso' },
  { key: 'resuelto', label: 'Resuelta' },
];

function statusStep(status: ManagementStatus): number {
  if (status === 'resuelto') return 2;
  if (status === 'en_tramite') return 1;
  return 0;
}

export function GestionCard({
  row,
  selected,
  statusLabels,
  onSelect,
  mobileDetail,
}: GestionCardProps) {
  const sourceEntries = getSourceEntries(row.source_values, {
    idAttributes: row.id_attributes,
    limit: 3,
  }).filter((entry) => {
    const key = entry.key.toLowerCase();
    if (key === 'survey_id') return false;
    if (key === 'survey_title' && entry.value === row.survey_title) return false;
    return true;
  });
  const activeStep = statusStep(row.management_status);
  const resolved = row.management_status === 'resuelto';

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 py-0 transition-colors',
        STATUS_LEFT_BORDER[row.management_status],
        selected && STATUS_SELECTED_CLASSES[row.management_status]
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className="w-full rounded-xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 font-semibold leading-snug text-foreground">
              {row.survey_title}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {buildFolioDisplay(row)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="outline"
              className={STATUS_BADGE_CLASSES[row.management_status]}
            >
              {statusLabels[row.management_status]}
            </Badge>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-slate-400 transition-transform lg:hidden',
                selected && 'rotate-180'
              )}
              aria-hidden
            />
          </div>
        </div>

        {sourceEntries.length > 0 && (
          <dl className="mt-2 space-y-1">
            {sourceEntries.map((entry) => (
              <div key={entry.key} className="flex gap-1.5 text-sm">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">
                  {entry.label}:
                </dt>
                <dd className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Capturada {formatGestionDate(row.created_at)}
        </p>

        {row.management_status === 'problema' ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Esta gestión tiene un problema reportado
          </div>
        ) : (
          <div
            className="mt-4 grid grid-cols-3 gap-1"
            aria-label={`Progreso: ${STEPS[activeStep].label}`}
          >
            {STEPS.map((step, index) => {
              const reached = index <= activeStep;
              return (
                <div key={step.key} className="relative text-center">
                  {index > 0 && (
                    <span
                      className={cn(
                        'absolute right-1/2 top-2 h-0.5 w-full',
                        index <= activeStep
                          ? resolved
                            ? 'bg-green-600'
                            : 'bg-amber-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative mx-auto flex h-4 w-4 items-center justify-center rounded-full',
                      reached
                        ? resolved
                          ? 'bg-green-600 text-white'
                          : 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                    )}
                  >
                    {index < activeStep ? (
                      <Check className="h-2.5 w-2.5" aria-hidden />
                    ) : (
                      <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      'mt-1 block text-[10px]',
                      reached
                        ? 'font-medium text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </button>

      {selected && mobileDetail && (
        <CardContent className="border-t px-4 py-4 lg:hidden">
          {mobileDetail}
        </CardContent>
      )}
    </Card>
  );
}
