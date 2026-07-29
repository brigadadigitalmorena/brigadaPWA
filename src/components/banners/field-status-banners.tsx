'use client';

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, FileEdit, CloudOff } from 'lucide-react';
import { useSync } from '@/contexts/sync.context';
import { db } from '@/lib/db/database';
import { InlineBanner } from '@/components/ui/inline-banner';
import { Button } from '@/components/ui/button';

/**
 * Field-critical banners: dead-letter, drafts, offline — mobile parity.
 */
export function FieldStatusBanners() {
  const { isOnline, deadLetterCount, pendingCount, retryFailed, clearDeadLetter } = useSync();

  const draftCount =
    useLiveQuery(
      () => db.responses.where('status').equals('draft').count(),
      []
    ) ?? 0;

  return (
    <div className="space-y-2">
      {!isOnline && (
        <InlineBanner
          variant="warning"
          message="Sin conexión. Puedes capturar encuestas; se enviarán al recuperar red."
        />
      )}

      {(deadLetterCount ?? 0) > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">
                {deadLetterCount} envío{deadLetterCount !== 1 ? 's' : ''} con error
              </p>
              <p className="text-muted-foreground">
                Revisa la cola de sincronización o reintenta el envío.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={retryFailed}>
              Reintentar
            </Button>
            <Button size="sm" variant="ghost" onClick={clearDeadLetter}>
              Descartar
            </Button>
            <Link
              href="/sync"
              className="inline-flex h-7 items-center rounded-lg bg-secondary px-2.5 text-[0.8rem] font-medium"
            >
              Ver
            </Link>
          </div>
        </div>
      )}

      {draftCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-3">
          <FileEdit className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm min-w-0">
            <p className="font-medium">
              {draftCount} borrador{draftCount !== 1 ? 'es' : ''} guardado
              {draftCount !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/drafts"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
          >
            Continuar
          </Link>
        </div>
      )}

      {isOnline && pendingCount > 0 && (deadLetterCount ?? 0) === 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <CloudOff className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">
              {pendingCount} elemento{pendingCount !== 1 ? 's' : ''} pendiente
              {pendingCount !== 1 ? 's' : ''} de sincronizar
            </p>
          </div>
          <Link
            href="/sync"
            className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
          >
            Envíos
          </Link>
        </div>
      )}
    </div>
  );
}
