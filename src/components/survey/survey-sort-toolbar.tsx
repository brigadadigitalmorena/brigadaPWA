'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownUp,
  BadgeCheck,
  CalendarArrowUp,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  LetterText,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  icon: LucideIcon;
  group: 'dates' | 'title' | 'status';
}> = [
  {
    key: 'ends_at',
    label: 'Fecha de fin',
    hintAsc: 'más próxima primero',
    hintDesc: 'más lejana primero',
    icon: CalendarClock,
    group: 'dates',
  },
  {
    key: 'starts_at',
    label: 'Fecha de inicio',
    hintAsc: 'más próxima primero',
    hintDesc: 'más lejana primero',
    icon: CalendarArrowUp,
    group: 'dates',
  },
  {
    key: 'assigned_at',
    label: 'Fecha de campaña',
    hintAsc: 'más antigua primero',
    hintDesc: 'más reciente primero',
    icon: CalendarDays,
    group: 'dates',
  },
  {
    key: 'title',
    label: 'Título',
    hintAsc: 'A-Z',
    hintDesc: 'Z-A',
    icon: LetterText,
    group: 'title',
  },
  {
    key: 'status',
    label: 'Estado',
    hintAsc: 'pendientes primero',
    hintDesc: 'completadas primero',
    icon: BadgeCheck,
    group: 'status',
  },
  {
    key: 'type',
    label: 'Tipo',
    hintAsc: 'gestión primero',
    hintDesc: 'gestión al final',
    icon: ClipboardList,
    group: 'status',
  },
];

const SORT_GROUPS: Array<{
  id: 'dates' | 'title' | 'status';
  label: string;
}> = [
  { id: 'dates', label: 'Fechas' },
  { id: 'title', label: 'Título' },
  { id: 'status', label: 'Estado y tipo' },
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
  const ActiveIcon = active?.icon ?? ArrowDownUp;
  const currentValue = optionValue(sortKey, sortDir);
  const currentLabel = active ? optionLabel(active, sortDir) : 'Ordenar';

  return (
    <div
      className={cn(
        'sticky top-0 z-10 -mx-1 border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Orden
        </span>

        <Select
          value={currentValue}
          onValueChange={(value) => {
            if (value == null) return;
            const parsed = parseOptionValue(String(value));
            if (!parsed) return;
            onChange(parsed.key, parsed.dir);
          }}
        >
          <SelectTrigger
            aria-label="Criterio de ordenamiento de encuestas"
            className={cn(
              'h-11 min-h-11 w-full max-w-full gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm',
              'hover:bg-muted/40 focus-visible:border-ring',
              'sm:w-auto sm:min-w-[18rem] sm:max-w-md'
            )}
          >
            <ActiveIcon
              className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
              aria-hidden
            />
            <SelectValue className="min-w-0">
              <span className="truncate">{currentLabel}</span>
            </SelectValue>
          </SelectTrigger>

          <SelectContent
            align="start"
            side="bottom"
            sideOffset={6}
            alignItemWithTrigger={false}
            className={cn(
              'z-[60] w-[min(calc(100vw-1.5rem),22rem)] min-w-[min(var(--anchor-width),22rem)]',
              'rounded-2xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-black/5',
              'dark:ring-white/10'
            )}
          >
            {SORT_GROUPS.map((group, groupIndex) => {
              const options = SORT_OPTIONS.filter(
                (option) => option.group === group.id
              );
              return (
                <div key={group.id}>
                  {groupIndex > 0 ? (
                    <SelectSeparator className="my-1.5 bg-border/70" />
                  ) : null}
                  <SelectGroup className="p-0.5">
                    <SelectLabel className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {group.label}
                    </SelectLabel>
                    {options.flatMap((option) => {
                      const Icon = option.icon;
                      return (['asc', 'desc'] as const).map((dir) => {
                        const value = optionValue(option.key, dir);
                        const selected = value === currentValue;
                        return (
                          <SelectItem
                            key={value}
                            value={value}
                            className={cn(
                              'min-h-11 gap-2.5 rounded-xl py-2.5 pr-9 pl-2.5 text-sm',
                              'focus:bg-muted focus:text-foreground',
                              selected &&
                                'bg-primary/8 font-medium text-foreground data-[highlighted]:bg-primary/12'
                            )}
                          >
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                selected
                                  ? 'text-primary'
                                  : 'text-slate-500 dark:text-slate-400'
                              )}
                              aria-hidden
                            />
                            <span className="whitespace-normal text-left leading-snug">
                              {optionLabel(option, dir)}
                            </span>
                          </SelectItem>
                        );
                      });
                    })}
                  </SelectGroup>
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <p className="sr-only" aria-live="polite">
        Orden activo: {currentLabel}
      </p>
    </div>
  );
}
