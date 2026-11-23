'use client';

import { ArrowDownUp } from 'lucide-react';
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
}> = [
  {
    key: 'ends_at',
    label: 'Fecha de fin',
    hintAsc: 'más próxima primero',
    hintDesc: 'más lejana primero',
  },
  {
    key: 'starts_at',
    label: 'Fecha de inicio',
    hintAsc: 'más próxima primero',
    hintDesc: 'más lejana primero',
  },
  {
    key: 'assigned_at',
    label: 'Fecha de campaña',
    hintAsc: 'más antigua primero',
    hintDesc: 'más reciente primero',
  },
  {
    key: 'title',
    label: 'Título',
    hintAsc: 'A-Z',
    hintDesc: 'Z-A',
  },
  {
    key: 'status',
    label: 'Estado',
    hintAsc: 'pendientes primero',
    hintDesc: 'completadas primero',
  },
  {
    key: 'type',
    label: 'Tipo',
    hintAsc: 'gestión primero',
    hintDesc: 'gestión al final',
  },
];

function optionValue(key: SortKey, dir: SortDir): string {
  return `${key}:${dir}`;
}

function parseOptionValue(value: string): { key: SortKey; dir: SortDir } | null {
  const [rawKey, rawDir] = value.split(':');
  const option = SORT_OPTIONS.find((item) => item.key === rawKey);
  if (!option) return null;
  if (rawDir !== 'asc' && rawDir !== 'desc') return null;
  return { key: option.key, dir: rawDir };
}

function optionLabel(
  option: (typeof SORT_OPTIONS)[number],
  dir: SortDir
): string {
  const hint = dir === 'asc' ? option.hintAsc : option.hintDesc;
  return `${option.label}: ${hint}`;
}

interface SurveySortToolbarProps {
  sortKey: SortKey;
  sortDir: SortDir;
  onChange: (key: SortKey, dir: SortDir) => void;
  className?: string;
}

export function SurveySortToolbar({
  sortKey,
  sortDir,
  onChange,
  className,
}: SurveySortToolbarProps) {
  const active = SORT_OPTIONS.find((option) => option.key === sortKey);
  const selectId = 'survey-sort-select';

  return (
    <div
      className={cn(
        'sticky top-0 z-10 -mx-1 space-y-1 border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ArrowDownUp
          className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
          aria-hidden
        />
        <label
          htmlFor={selectId}
          className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          Orden
        </label>
        <select
          id={selectId}
          value={optionValue(sortKey, sortDir)}
          onChange={(event) => {
            const parsed = parseOptionValue(event.target.value);
            if (!parsed) return;
            onChange(parsed.key, parsed.dir);
          }}
          aria-label="Criterio de ordenamiento de encuestas"
          className={cn(
            'min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2',
            'text-sm font-medium text-foreground',
            'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
          )}
        >
          {SORT_OPTIONS.flatMap((option) =>
            (['asc', 'desc'] as const).map((dir) => (
              <option key={optionValue(option.key, dir)} value={optionValue(option.key, dir)}>
                {optionLabel(option, dir)}
              </option>
            ))
          )}
        </select>
      </div>
      {active ? (
        <p className="sr-only" aria-live="polite">
          Orden activo: {optionLabel(active, sortDir)}
        </p>
      ) : null}
    </div>
  );
}
