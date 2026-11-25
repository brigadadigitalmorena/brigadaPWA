'use client';

import { useState, type MouseEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ChevronRight,
  CloudOff,
  FileEdit,
  X,
} from 'lucide-react';
import { useSync } from '@/contexts/sync.context';
import { useDraftCount } from '@/components/common/draft-count';
import { InlineBanner } from '@/components/ui/inline-banner';
import { Button } from '@/components/ui/button';
import { RecorridoBanner } from '@/components/banners/recorrido-banner';
import { FieldAlertBanners } from '@/components/banners/field-alert-banners';
import { cn } from '@/lib/utils';

function goTo(path: string) {
  // Hard navigation so SW / offline soft-nav does not strand the user.
  window.location.assign(path);
}

/**
 * Field-critical banners: dead-letter, drafts, offline — mobile parity.
 * Informational banners are dismissible; Recorrido stays sticky (consent).
 *
 * Visibility: dismiss is local. Drafts / pending reappear if their count
 * changes; offline resets when connectivity returns; sync notices/errors
 * reappear when the message changes (InlineBanner keys off `message`).
 */
export function FieldStatusBanners() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isOnline,
    isSyncing,
    deadLetterCount,
    pendingCount,
    retryFailed,
    clearDeadLetter,
    syncNow,
    error: syncError,
    syncNotice,
    dismissSyncNotice,
  } = useSync();
  const onSyncPage = pathname === '/sync';
  const draftCount = useDraftCount();

  const [draftsDismissedFor, setDraftsDismissedFor] = useState<number | null>(
    null
  );
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const [deadLetterDismissedFor, setDeadLetterDismissedFor] = useState<
    number | null
  >(null);
  const [pendingDismissedFor, setPendingDismissedFor] = useState<number | null>(
    null
  );
  const [wasOnline, setWasOnline] = useState(isOnline);

  if (wasOnline !== isOnline) {
    setWasOnline(isOnline);
    if (isOnline) setOfflineDismissed(false);
  }
  if (draftsDismissedFor !== null && draftCount !== draftsDismissedFor) {
    setDraftsDismissedFor(null);
  }
  if (
    deadLetterDismissedFor !== null &&
    (deadLetterCount ?? 0) !== deadLetterDismissedFor
  ) {
    setDeadLetterDismissedFor(null);
  }
  if (pendingDismissedFor !== null && pendingCount !== pendingDismissedFor) {
    setPendingDismissedFor(null);
  }

  const openSync = () => {
    if (onSyncPage) return;
    if (!isOnline) {
      window.location.assign('/sync');
      return;
    }
    router.push('/sync');
  };

  const showDrafts = draftCount > 0 && draftsDismissedFor !== draftCount;
  const showOffline = !isOnline && !offlineDismissed;
  const showDeadLetter =
    (deadLetterCount ?? 0) > 0 && deadLetterDismissedFor !== deadLetterCount;
  const showPending =
    isOnline &&
    pendingCount > 0 &&
    (deadLetterCount ?? 0) === 0 &&
    pendingDismissedFor !== pendingCount;

  const dismissDrafts = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraftsDismissedFor(draftCount);
  };

  return (
    <div className="space-y-2">
      {/* FIELD-TRACK-1 — not dismissible: active route consent/reliability. */}
      <RecorridoBanner />
      <FieldAlertBanners />

      {showOffline && (
        <InlineBanner
          variant="warning"
          message="Sin conexión. Puedes capturar encuestas; se enviarán al recuperar red."
          onClose={() => setOfflineDismissed(true)}
        />
      )}

      {showDeadLetter && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-destructive">
                {deadLetterCount} envío{deadLetterCount !== 1 ? 's' : ''} con
                error
              </p>
              <p className="text-muted-foreground">
                Revisa el detalle en Envíos o reintenta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeadLetterDismissedFor(deadLetterCount ?? 0)}
              className="touch-target -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={retryFailed}>
              Reintentar
            </Button>
            <Button size="sm" variant="ghost" onClick={clearDeadLetter}>
              Descartar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={openSync}
            >
              Ver
            </Button>
          </div>
        </div>
      )}

      {showDrafts && (
        <div
          role="status"
          className={cn(
            'flex w-full items-center gap-1 rounded-xl border border-amber-500/25',
            'bg-amber-500/5 text-left transition-colors'
          )}
        >
          <button
            type="button"
            onClick={() => goTo('/drafts')}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2',
              'hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-l-xl'
            )}
            aria-label={`Continuar ${draftCount} borrador${draftCount !== 1 ? 'es' : ''} guardado${draftCount !== 1 ? 's' : ''}`}
          >
            <FileEdit className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span className="min-w-0 flex-1 text-sm font-medium">
              {draftCount} borrador{draftCount !== 1 ? 'es' : ''} guardado
              {draftCount !== 1 ? 's' : ''}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-amber-700/70"
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={dismissDrafts}
            className={cn(
              'touch-target mr-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
              'text-amber-800/80 opacity-80 hover:bg-amber-500/15 hover:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {syncNotice?.confirmed && (
        <InlineBanner
          variant={syncNotice.tone === 'warning' ? 'warning' : 'success'}
          message={syncNotice.message}
          onClose={dismissSyncNotice}
        />
      )}

      {syncError && (
        <InlineBanner
          variant="error"
          message={syncError}
          onClose={dismissSyncNotice}
        />
      )}

      {showPending && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <CloudOff className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {pendingCount} elemento{pendingCount !== 1 ? 's' : ''} pendiente
              {pendingCount !== 1 ? 's' : ''} de sincronizar
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={onSyncPage && isSyncing}
            onClick={() => {
              if (onSyncPage) {
                void syncNow('user');
                return;
              }
              openSync();
            }}
          >
            {onSyncPage ? (isSyncing ? 'Enviando…' : 'Enviar') : 'Envíos'}
          </Button>
          <button
            type="button"
            onClick={() => setPendingDismissedFor(pendingCount)}
            className="touch-target -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
