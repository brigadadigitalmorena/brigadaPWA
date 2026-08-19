'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getMyEntitlements } from '@/lib/api/survey.service';
import type { Assignment } from '@/lib/types';
import { campaignLabel, surveyFillHref } from '@/lib/campaigns/scope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { RecorridoCard } from '@/components/recorrido/recorrido-card';
import { SkeletonSurveyCard } from '@/components/ui/skeleton';
import {
  ClipboardList,
  Play,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Users,
  RefreshCw,
  GitBranch,
  Type,
  CircleDot,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  warmSurveyFillUrls,
  canOpenSurveyOffline,
} from '@/lib/services/offline-warm.service';

interface AssignedSurvey extends Assignment {}

type SortKey =
  | 'ends_at'
  | 'starts_at'
  | 'assigned_at'
  | 'title'
  | 'status'
  | 'type';

type SortDir = 'asc' | 'desc';
type UrgencyTone = 'ok' | 'soon' | 'overdue';

const SORT_STORAGE_KEY = 'brigada.surveys.sort';

const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  ends_at: 'asc',
  starts_at: 'asc',
  assigned_at: 'desc',
  title: 'asc',
  status: 'asc',
  type: 'asc',
};

const SORT_OPTIONS: Array<{
  key: SortKey;
  label: string;
  icon: typeof CalendarClock;
}> = [
  { key: 'ends_at', label: 'Ordenar por fecha de fin', icon: CalendarClock },
  { key: 'starts_at', label: 'Ordenar por fecha de inicio', icon: CalendarPlus },
  { key: 'assigned_at', label: 'Ordenar por fecha de campaña', icon: Calendar },
  { key: 'title', label: 'Ordenar por título', icon: Type },
  { key: 'status', label: 'Ordenar por estado', icon: CircleDot },
  { key: 'type', label: 'Ordenar por tipo (gestión primero)', icon: GitBranch },
];

function fillHref(survey: AssignedSurvey): string {
  return surveyFillHref(survey);
}

function generatesFollowUp(survey: AssignedSurvey): boolean {
  return survey.survey_type === 'gestion';
}

function formatShortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function dateMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function compareNullableDate(
  a: string | null | undefined,
  b: string | null | undefined,
  dir: SortDir
): number {
  const aMs = dateMs(a);
  const bMs = dateMs(b);
  if (aMs === null && bMs === null) return 0;
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  return dir === 'asc' ? aMs - bMs : bMs - aMs;
}

function statusRank(status: string): number {
  return status === 'completed' ? 1 : 0;
}

function typeRank(survey: AssignedSurvey): number {
  return generatesFollowUp(survey) ? 0 : 1;
}

function sortSurveys(
  list: AssignedSurvey[],
  key: SortKey,
  dir: SortDir
): AssignedSurvey[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let result = 0;
    switch (key) {
      case 'ends_at':
        result = compareNullableDate(a.ends_at, b.ends_at, dir);
        break;
      case 'starts_at':
        result = compareNullableDate(a.starts_at, b.starts_at, dir);
        break;
      case 'assigned_at':
        result = compareNullableDate(a.assigned_at, b.assigned_at, dir);
        break;
      case 'title': {
        const cmp = a.survey_title.localeCompare(b.survey_title, 'es', {
          sensitivity: 'base',
        });
        result = dir === 'asc' ? cmp : -cmp;
        break;
      }
      case 'status': {
        const cmp = statusRank(a.entitlement_status) - statusRank(b.entitlement_status);
        result = dir === 'asc' ? cmp : -cmp;
        break;
      }
      case 'type': {
        const cmp = typeRank(a) - typeRank(b);
        result = dir === 'asc' ? cmp : -cmp;
        break;
      }
    }
    if (result !== 0) return result;
    return a.entitlement_id - b.entitlement_id;
  });
  return sorted;
}

function urgencyTone(
  endsAt: string | null | undefined,
  isCompleted: boolean
): UrgencyTone {
  if (isCompleted || !endsAt) return 'ok';
  const ms = dateMs(endsAt);
  if (ms === null) return 'ok';
  const hoursLeft = (ms - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return 'overdue';
  if (hoursLeft < 24) return 'soon';
  return 'ok';
}

function readStoredSort(): { key: SortKey; dir: SortDir } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return { key: 'ends_at', dir: DEFAULT_SORT_DIR.ends_at };
    const parsed = JSON.parse(raw) as { key?: string; dir?: string };
    const key = SORT_OPTIONS.some((o) => o.key === parsed.key)
      ? (parsed.key as SortKey)
      : 'ends_at';
    const dir = parsed.dir === 'asc' || parsed.dir === 'desc'
      ? parsed.dir
      : DEFAULT_SORT_DIR[key];
    return { key, dir };
  } catch {
    return { key: 'ends_at', dir: DEFAULT_SORT_DIR.ends_at };
  }
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<AssignedSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('ends_at');
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR.ends_at);
  const [sortHydrated, setSortHydrated] = useState(false);

  const loadSurveys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getMyEntitlements();
      setSurveys(data);
      warmSurveyFillUrls(data);
    } catch (err) {
      console.error('Failed to load surveys:', err);
      setError(
        'Error al cargar las encuestas. Si ya las viste antes, revisa que haya caché offline o reintenta con conexión.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadSurveys();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadSurveys]);

  useEffect(() => {
    const stored = readStoredSort();
    setSortKey(stored.key);
    setSortDir(stored.dir);
    setSortHydrated(true);
  }, []);

  useEffect(() => {
    if (!sortHydrated) return;
    try {
      localStorage.setItem(
        SORT_STORAGE_KEY,
        JSON.stringify({ key: sortKey, dir: sortDir })
      );
    } catch {
      // ignore quota / private mode
    }
  }, [sortKey, sortDir, sortHydrated]);

  const sortedSurveys = useMemo(
    () => sortSurveys(surveys, sortKey, sortDir),
    [surveys, sortKey, sortDir]
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(DEFAULT_SORT_DIR[key]);
  };

  const handleOpenSurvey = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    survey: AssignedSurvey
  ) => {
    if (survey.entitlement_status === 'completed') {
      event.preventDefault();
      return;
    }

    const href = fillHref(survey);

    // Online: normal Next navigation + warm fill shell for offline later
    if (navigator.onLine) {
      warmSurveyFillUrls([survey]);
      return;
    }

    // Offline: allow any survey that has schema cached in Dexie (list visit),
    // not only the one whose fill URL was opened before (draft).
    event.preventDefault();
    const canOpen = await canOpenSurveyOffline(survey.survey_id);
    if (!canOpen) {
      toast.error(
        'Esta encuesta no está disponible offline. Conéctate y actualiza la lista de encuestas.'
      );
      return;
    }

    // Full navigation so the SW can serve the shared fill shell.
    // Soft nav (router.push) would request RSC and fail offline.
    window.location.assign(href);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Mis Encuestas"
          description="Cargando encuestas asignadas..."
        />
        <div className="flex flex-col gap-4">
          <SkeletonSurveyCard />
          <SkeletonSurveyCard />
          <SkeletonSurveyCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mis Encuestas" description="No se pudieron cargar tus encuestas" />
        <EmptyState
          icon={ClipboardList}
          title="Error"
          description={error}
          action={
            <Button size="mobile" onClick={loadSurveys} variant="outline" className="w-full sm:w-auto">
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Mis Encuestas"
          description="Encuestas asignadas para completar"
        />
        <EmptyState
          icon={ClipboardList}
          title="No tienes campañas activas"
          description="Cuando te asignen campañas, aparecerán aquí para que puedas completarlas desde tu dispositivo."
        />
      </div>
    );
  }

  const pendingCount = surveys.filter(
    (survey) => survey.entitlement_status !== 'completed'
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis Encuestas"
        description={
          pendingCount > 0
            ? `${pendingCount} encuesta${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`
            : 'Todas las encuestas completadas'
        }
        action={
          <Button
            variant="outline"
            size="mobile"
            onClick={loadSurveys}
            className="hidden sm:flex"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        }
      />

      <RecorridoCard />

      <div className="sticky top-0 z-10 -mx-1 border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <TooltipProvider delay={300}>
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
              const active = sortKey === option.key;
              const DirIcon = sortDir === 'asc' ? ArrowUp : ArrowDown;
              const ariaLabel = active
                ? `${option.label}, ${sortDir === 'asc' ? 'ascendente' : 'descendente'}. Tocá de nuevo para invertir.`
                : option.label;
              return (
                <Tooltip key={option.key}>
                  <TooltipTrigger
                    type="button"
                    aria-label={ariaLabel}
                    aria-pressed={active}
                    onClick={() => handleSort(option.key)}
                    className={cn(
                      'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
                      'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      active
                        ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-foreground hover:bg-muted'
                    )}
                  >
                    <span className="relative inline-flex items-center justify-center">
                      <Icon className="h-5 w-5" aria-hidden />
                      {active && (
                        <DirIcon
                          className="absolute -bottom-1.5 -right-1.5 h-3 w-3"
                          aria-hidden
                        />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{option.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        {sortedSurveys.map((survey) => {
          const isCompleted = survey.entitlement_status === 'completed';
          const isFollowUp = generatesFollowUp(survey);
          const startLabel = formatShortDate(survey.starts_at) ?? 'Sin inicio';
          const endLabel = formatShortDate(survey.ends_at) ?? 'Sin fin';
          const tone = urgencyTone(survey.ends_at, isCompleted);
          const assignedLabel = formatShortDate(survey.assigned_at);

          return (
            <Card
              key={survey.entitlement_id}
              className={cn(
                'overflow-hidden transition-shadow hover:shadow-md',
                isCompleted && 'opacity-80'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg leading-snug line-clamp-2">
                    {survey.survey_title}
                  </CardTitle>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <Badge
                      className={cn(
                        isCompleted
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                      )}
                      variant="outline"
                    >
                      {isCompleted ? 'Completada' : 'Pendiente'}
                    </Badge>
                    {isFollowUp && (
                      <Badge
                        variant="outline"
                        className="gap-1 bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20"
                      >
                        <GitBranch className="h-3 w-3" aria-hidden />
                        Gestión
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="space-y-2 pt-1">
                  <div className="flex items-start gap-2 text-sm text-foreground/80">
                    <CalendarRange className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="leading-snug">
                      <span className="text-muted-foreground">Inicio</span>{' '}
                      {startLabel}
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">Fin</span>{' '}
                      <span
                        className={cn(
                          tone === 'soon' &&
                            'font-medium text-amber-700 dark:text-amber-400',
                          tone === 'overdue' &&
                            'font-medium text-red-700 dark:text-red-400'
                        )}
                      >
                        {endLabel}
                      </span>
                    </span>
                  </div>
                  {assignedLabel && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Disponible: {assignedLabel}</span>
                    </div>
                  )}
                  {campaignLabel(survey) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span>{campaignLabel(survey)}</span>
                    </div>
                  )}
                  {survey.area_names && survey.area_names.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {survey.area_names.slice(0, 2).join(' · ')}
                      {survey.area_names.length > 2
                        ? ` +${survey.area_names.length - 2} más`
                        : ''}
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={fillHref(survey)}
                  onClick={(event) => handleOpenSurvey(event, survey)}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-all',
                    'hover:bg-primary/80 active:translate-y-px',
                    isCompleted && 'pointer-events-none opacity-50 bg-muted text-muted-foreground'
                  )}
                  aria-disabled={isCompleted}
                  tabIndex={isCompleted ? -1 : 0}
                >
                  <Play className="h-5 w-5" />
                  {isCompleted ? 'Completada' : 'Iniciar encuesta'}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
