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
  getSourceSummary,
  STATUS_BADGE_CLASSES,
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
  const sourceSummary = getSourceSummary(row.source_values);
  const activeStep = statusStep(row.management_status);

  return (
    <Card
      className={cn(
        'overflow-hidden transition-colors',
        selected && 'border-primary bg-primary/[0.025]'
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
            <p className="line-clamp-2 font-semibold leading-snug">
              {row.survey_title}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
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
                'h-4 w-4 text-muted-foreground transition-transform lg:hidden',
                selected && 'rotate-180'
              )}
              aria-hidden
            />
          </div>
        </div>

        {sourceSummary && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {sourceSummary}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
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
              const completed = index <= activeStep;
              return (
                <div key={step.key} className="relative text-center">
                  {index > 0 && (
                    <span
                      className={cn(
                        'absolute right-1/2 top-2 h-0.5 w-full',
                        index <= activeStep ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative mx-auto flex h-4 w-4 items-center justify-center rounded-full',
                      completed
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
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
                      completed
                        ? 'font-medium text-foreground'
                        : 'text-muted-foreground'
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
