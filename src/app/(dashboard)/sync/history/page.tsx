'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { buildResponseTimeline } from '@/lib/events/response-timeline';
import { PageHeader } from '@/components/common/page-header';

function HistoryBody() {
  const responseId = useSearchParams().get('responseId');
  const response = useLiveQuery(
    () =>
      responseId
        ? db.responses.where('response_id').equals(responseId).first()
        : undefined,
    [responseId]
  );
  const queue =
    useLiveQuery(
      () =>
        responseId
          ? db.sync_queue.where('entity_id').equals(responseId).toArray()
          : [],
      [responseId]
    ) ?? [];

  if (!responseId) {
    return <p className="text-sm text-muted-foreground">Falta el identificador del envío.</p>;
  }
  if (!response) {
    return <p className="text-sm text-muted-foreground">No hay un envío local con ese id.</p>;
  }

  const events = buildResponseTimeline(response, queue);

  return (
    <ol className="space-y-3">
      {events.map((event, index) => (
        <li key={`${event.type}-${event.at}-${index}`} className="rounded-xl border p-3">
          <p className="font-medium">{event.label}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(event.at).toLocaleString('es-MX')}
            {event.detail ? ` · ${event.detail}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function ResponseHistoryPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Historial del envío" description="Eventos locales de captura y sync" />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <HistoryBody />
      </Suspense>
    </div>
  );
}
