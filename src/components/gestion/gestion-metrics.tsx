import { AlertTriangle, CheckCircle2, Clock3, Layers3 } from 'lucide-react';
import type { GestionTrackingRow } from '@/lib/api/gestion.service';
import { METRIC_CHIP_CLASSES } from '@/lib/gestion/display';
import type { GestionStatusFilter } from './gestion-filters';
import { cn } from '@/lib/utils';

interface GestionMetricsProps {
  rows: GestionTrackingRow[];
  activeStatus: GestionStatusFilter;
  onStatusChange: (status: GestionStatusFilter) => void;
}

export function GestionMetrics({
  rows,
  activeStatus,
  onStatusChange,
}: GestionMetricsProps) {
  const counts = rows.reduce(
    (result, row) => {
      result[row.management_status] += 1;
      return result;
    },
    { pendiente: 0, en_tramite: 0, resuelto: 0, problema: 0 }
  );

  const items = [
    {
      key: 'all' as const,
      label: 'Total',
      value: rows.length,
      icon: Layers3,
    },
    {
      key: 'proceso' as const,
      label: 'En proceso',
      value: counts.pendiente + counts.en_tramite,
      icon: Clock3,
    },
    {
      key: 'resuelto' as const,
      label: 'Resueltas',
      value: counts.resuelto,
      icon: CheckCircle2,
    },
    {
      key: 'problema' as const,
      label: 'Problema',
      value: counts.problema,
      icon: AlertTriangle,
    },
  ];

  return (
    <section
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      aria-label="Resumen de gestiones"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeStatus === item.key;
        const colors = METRIC_CHIP_CLASSES[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onStatusChange(item.key)}
            aria-pressed={active}
            className={cn(
              'flex min-h-16 items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active ? colors.active : colors.idle
            )}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0', colors.icon)}
              aria-hidden
            />
            <span>
              <span
                className={cn(
                  'block text-xl font-semibold leading-none',
                  colors.value
                )}
              >
                {item.value}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.label}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
