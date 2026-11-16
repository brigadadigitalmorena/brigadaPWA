'use client';

import { Search, X } from 'lucide-react';
import type { ManagementStatus } from '@/lib/api/gestion.service';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type GestionStatusFilter =
  | ManagementStatus
  | 'all'
  | 'proceso';

interface SurveyOption {
  id: number;
  title: string;
}

interface GestionFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: GestionStatusFilter;
  onStatusChange: (value: GestionStatusFilter) => void;
  surveyId: number | 'all';
  onSurveyChange: (value: number | 'all') => void;
  surveys: SurveyOption[];
}

export function GestionFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  surveyId,
  onSurveyChange,
  surveys,
}: GestionFiltersProps) {
  const hasFilters = query.trim() !== '' || status !== 'all' || surveyId !== 'all';

  return (
    <section className="space-y-3" aria-label="Filtros de gestiones">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por folio, encuesta o referencia"
            aria-label="Buscar gestiones"
            inputSize="mobile"
            className="pl-10"
          />
        </div>
        {surveys.length > 1 && (
          <select
            value={surveyId}
            onChange={(event) =>
              onSurveyChange(
                event.target.value === 'all'
                  ? 'all'
                  : Number(event.target.value)
              )
            }
            aria-label="Filtrar por encuesta"
            className="h-12 min-w-48 rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">Todas las encuestas</option>
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title}
              </option>
            ))}
          </select>
        )}
        {hasFilters && (
          <TooltipProvider delay={200}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Limpiar"
                    onClick={() => {
                      onQueryChange('');
                      onStatusChange('all');
                      onSurveyChange('all');
                    }}
                    className="shrink-0 self-end text-muted-foreground sm:self-auto"
                  >
                    <X aria-hidden />
                  </Button>
                }
              />
              <TooltipContent side="bottom">Limpiar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </section>
  );
}
