'use client';

import {
  ALargeSmall,
  BadgeCheck,
  CalendarArrowUp,
  CalendarClock,
  Flag,
  Workflow,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type SortKey =
  | 'ends_at'
  | 'starts_at'
  | 'assigned_at'
  | 'title'
  | 'status'
  | 'type';

export type SortDir = 'asc' | 'desc';

export const SORT_OPTIONS: Array<{
  key: SortKey;
  label: string;
  hintAsc: string;
  hintDesc: string;
  icon: typeof CalendarClock;
}> = [
  {
    key: 'ends_at',
    label: 'Fecha de fin',
    hintAsc: 'la más próxima primero',
    hintDesc: 'la más lejana primero',
    icon: CalendarClock,
  },
  {
    key: 'starts_at',
    label: 'Fecha de inicio',
    hintAsc: 'la más próxima primero',
    hintDesc: 'la más lejana primero',
    icon: CalendarArrowUp,
  },
  {
    key: 'assigned_at',
    label: 'Fecha de campaña',
    hintAsc: 'la más antigua primero',
    hintDesc: 'la más reciente primero',
    icon: Flag,
  },
  {
    key: 'title',
    label: 'Título',
    hintAsc: 'A-Z',
    hintDesc: 'Z-A',
    icon: ALargeSmall,
  },
  {
    key: 'status',
    label: 'Estado',
    hintAsc: 'pendientes primero',
    hintDesc: 'completadas primero',
    icon: BadgeCheck,
  },
  {
    key: 'type',
    label: 'Tipo',
    hintAsc: 'gestión primero',
    hintDesc: 'gestión al final',
    icon: Workflow,
  },
];

interface SurveySortToolbarProps {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

export function SurveySortToolbar({
  sortKey,
  sortDir,
  onSort,
}: SurveySortToolbarProps) {
  const active = SORT_OPTIONS.find((option) => option.key === sortKey);
  const DirIcon = sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TooltipProvider delay={0}>
      <div className="sticky top-0 z-10 -mx-1 space-y-1.5 border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div
          className="flex items-center gap-1 overflow-x-auto pb-0.5"
          role="toolbar"
          aria-label="Ordenar encuestas"
        >
          <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">
            Orden
          </span>
          {SORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = sortKey === option.key;
            const hint = sortDir === 'asc' ? option.hintAsc : option.hintDesc;
            const ariaLabel = isActive
              ? `${option.label}, ${hint}. Toca de nuevo para invertir.`
              : `Ordenar por ${option.label.toLowerCase()}`;

            return (
              <Tooltip key={option.key}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={ariaLabel}
                      title={ariaLabel}
                      aria-pressed={isActive}
                      onClick={() => onSort(option.key)}
                      className={cn(
                        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
                        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        isActive
                          ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                          : 'border-border bg-background text-foreground hover:bg-muted'
                      )}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <Icon className="h-5 w-5" aria-hidden />
                        {isActive && (
                          <DirIcon
                            className="absolute -right-1.5 -bottom-1.5 h-3 w-3"
                            aria-hidden
                          />
                        )}
                      </span>
                    </button>
                  }
                />
                <TooltipContent side="bottom">
                  <p className="font-medium">{option.label}</p>
                  <p className="text-[11px] opacity-80">
                    {isActive
                      ? `Activo: ${hint}. Toca para invertir.`
                      : `Ordenar por ${option.label.toLowerCase()}`}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {active && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {active.label}
            {' · '}
            {sortDir === 'asc' ? active.hintAsc : active.hintDesc}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
