'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getMyAssignments } from '@/lib/api/survey.service';
import type { Assignment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { SkeletonSurveyCard } from '@/components/ui/skeleton';
import { ClipboardList, Play, Calendar, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  warmSurveyFillUrls,
  isUrlCachedOffline,
} from '@/lib/services/offline-warm.service';

interface AssignedSurvey extends Assignment {}

function fillHref(survey: AssignedSurvey): string {
  return `/surveys/${survey.survey_id}/fill?title=${encodeURIComponent(survey.survey_title)}`;
}

export default function SurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<AssignedSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSurveys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getMyAssignments();
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

  const handleOpenSurvey = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    survey: AssignedSurvey
  ) => {
    if (survey.assignment_status === 'completed') {
      event.preventDefault();
      return;
    }

    const href = fillHref(survey);

    // Online: normal navigation + ensure cache warm
    if (navigator.onLine) {
      warmSurveyFillUrls([survey]);
      return;
    }

    // Offline: only open if the document (or ignore-search variant) was cached
    // while online; otherwise prevent Chrome ERR_FAILED on a cold deep link.
    event.preventDefault();
    const cached = await isUrlCachedOffline(href);
    if (!cached) {
      toast.error(
        'Esta encuesta aún no está disponible offline. Conéctate, ábrela una vez, y quedará lista sin red.'
      );
      return;
    }

    router.push(href);
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
          title="No tienes encuestas asignadas"
          description="Cuando te asignen encuestas, aparecerán aquí para que puedas completarlas desde tu dispositivo."
        />
      </div>
    );
  }

  const pendingCount = surveys.filter(
    (survey) => survey.assignment_status !== 'completed'
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

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        {surveys.map((survey) => {
          const isCompleted = survey.assignment_status === 'completed';

          return (
            <Card
              key={survey.assignment_id}
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
                  <Badge
                    className={cn(
                      'flex-shrink-0',
                      isCompleted
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    )}
                    variant="outline"
                  >
                    {isCompleted ? 'Completada' : 'Pendiente'}
                  </Badge>
                </div>
                <CardDescription className="space-y-2 pt-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Asignada:{' '}
                      {new Date(survey.assigned_at).toLocaleDateString()}
                    </span>
                  </div>
                  {survey.group_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span>{survey.group_name}</span>
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
