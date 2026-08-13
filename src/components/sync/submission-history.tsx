'use client';

import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, MapPin } from 'lucide-react';
import type { Response } from '@/lib/db/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';

const PAGE_SIZE = 50;

interface SubmissionHistoryProps {
  responses: Response[];
  surveyTitles: Map<string, string>;
}

function shortFolio(responseId: string): string {
  const compact = responseId.replaceAll('-', '');
  return compact.slice(-8).toUpperCase();
}

function confirmedAt(response: Response): string {
  return (
    response.last_synced_at ||
    response.completed_at ||
    response.updated_at ||
    response.created_at
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SubmissionHistory({
  responses,
  surveyTitles,
}: SubmissionHistoryProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = responses.slice(0, visibleCount);

  if (responses.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Aún no tienes envíos confirmados"
        description="Cuando completes una encuesta y el servidor la confirme, aparecerá aquí."
      />
    );
  }

  return (
    <section className="space-y-3" aria-label="Historial de envíos confirmados">
      <p className="text-sm text-muted-foreground">
        {responses.length}{' '}
        {responses.length === 1 ? 'envío confirmado' : 'envíos confirmados'}
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((response) => {
          const hasLocation =
            response.latitude != null && response.longitude != null;
          return (
            <Card key={response.response_id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-2 text-base leading-snug">
                      {surveyTitles.get(response.survey_id) ||
                        `Encuesta #${response.survey_id}`}
                    </CardTitle>
                    <p className="mt-1 font-mono text-xs font-medium text-primary">
                      Folio {shortFolio(response.response_id)}
                    </p>
                  </div>
                  <Badge className="shrink-0 gap-1 bg-green-500/10 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Enviado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Confirmado {formatDateTime(confirmedAt(response))}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {hasLocation && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                      <MapPin className="h-3 w-3" aria-hidden />
                      Con ubicación
                    </span>
                  )}
                  {response.duration_seconds != null && (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {Math.max(0, Math.round(response.duration_seconds / 60))} min
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleCount < responses.length && (
        <Button
          type="button"
          variant="outline"
          size="mobile"
          className="w-full sm:w-auto"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          Mostrar más
        </Button>
      )}
    </section>
  );
}
