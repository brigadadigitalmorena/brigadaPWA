'use client';

/**
 * FIELD-TRACK-1 — always-visible reminder that a route is being recorded.
 *
 * Serves two purposes: consent (the brigadista can never be tracked without
 * seeing it) and reliability (it repeats the "keep this tab open" constraint
 * that the web platform imposes).
 */
import { Navigation } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFieldSession } from '@/hooks/use-field-session';

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export function RecorridoBanner() {
  const { session, isCollecting, busy, end } = useFieldSession();

  if (!session) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-3">
      <Navigation className="h-5 w-5 shrink-0 text-green-600" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Recorrido en curso</p>
        <p className="truncate text-muted-foreground">
          {formatDistance(session.distance_m)} · {session.sample_count} puntos ·{' '}
          {isCollecting
            ? 'mantén la aplicación abierta'
            : 'captura detenida'}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void end('manual')}
      >
        Finalizar
      </Button>
    </div>
  );
}
