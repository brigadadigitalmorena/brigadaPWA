'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { toResponseMapPoints, type ResponseMapPoint } from '@/lib/maps/response-points';
import { PageHeader } from '@/components/common/page-header';
import { SubmissionMap } from '@/components/maps/submission-map';
import { Button } from '@/components/ui/button';

export default function SubmissionMapPage() {
  const rows = useLiveQuery(() => db.responses.toArray(), []) ?? [];
  const points = toResponseMapPoints(rows);
  const [selected, setSelected] = useState<ResponseMapPoint | null>(null);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Mapa de envíos"
        description="Respuestas con ubicación, coloreadas por estado de sync"
        action={
          <Link href="/sync">
            <Button variant="outline" size="sm">
              Volver a envíos
            </Button>
          </Link>
        }
      />
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Enviado
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Pendiente
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Error
        </span>
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay envíos con coordenadas. Las respuestas con GPS aparecen aquí.
        </p>
      ) : (
        <SubmissionMap points={points} onSelect={setSelected} />
      )}
      {selected && (
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <p className="font-medium">Envío {selected.responseId}</p>
          <p className="text-muted-foreground">
            Encuesta {selected.surveyId} · {selected.syncStatus}
            {selected.accuracy != null ? ` · ±${Math.round(selected.accuracy)} m` : ''}
          </p>
          <Link
            href={`/sync/history?responseId=${encodeURIComponent(selected.responseId)}`}
            className="mt-2 inline-block font-medium text-primary"
          >
            Ver historial
          </Link>
        </div>
      )}
    </div>
  );
}
