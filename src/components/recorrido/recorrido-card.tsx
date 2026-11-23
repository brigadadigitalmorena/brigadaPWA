'use client';

import Link from 'next/link';
/**
 * FIELD-TRACK-1 — start/stop control for the brigadista's route session.
 *
 * The web platform cannot track in the background, so the card is explicit
 * about the deal: the tab has to stay open. It shows live totals and the Wake
 * Lock state so the brigadista can tell at a glance whether the phone screen
 * is being kept awake for them.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Navigation, MapPin, Ruler, CloudUpload, Lightbulb } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFieldSession } from '@/hooks/use-field-session';
import { DEFAULT_FIELD_TRACKING } from '@/lib/api/field-session.service';
import { cn } from '@/lib/utils';

function formatElapsed(fromIso: string): string {
  const startedAt = new Date(fromIso).getTime();
  if (!Number.isFinite(startedAt)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

export function RecorridoCard() {
  const { session, pendingSamples, isCollecting, wakeLockHeld, busy, start, end } =
    useFieldSession();

  // The elapsed counter is derived from a timestamp, so it needs its own tick
  // to stay current between Dexie updates.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, [session]);

  const handleStart = async () => {
    const result = await start({ config: DEFAULT_FIELD_TRACKING });
    if (result.ok) {
      toast.success('Recorrido iniciado', {
        description: 'Mantén esta pestaña abierta para registrar tu ruta.',
      });
      return;
    }
    toast.error('No se pudo iniciar el recorrido', {
      description: result.message,
    });
  };

  const handleEnd = async () => {
    await end('manual');
    toast.success('Recorrido finalizado', {
      description: 'Los puntos pendientes se enviarán en la próxima sincronización.',
    });
  };

  const active = Boolean(session);

  return (
    <Card
      className={cn(
        active
          ? 'border-green-600/45 bg-green-500/5 shadow-sm ring-1 ring-green-500/20'
          : 'border-border'
      )}
    >
      <CardHeader className={cn('pb-3', !active && 'pb-2')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              <Navigation
                className={cn(
                  'h-5 w-5 shrink-0',
                  active ? 'text-green-700 dark:text-green-400' : 'text-primary'
                )}
              />
              <span>{active ? 'Recorrido en curso' : 'Recorrido'}</span>
              {active ? (
                <Badge
                  variant="outline"
                  className="border-green-600/35 bg-green-500/15 font-medium text-green-800 dark:text-green-300"
                >
                  Activo
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription
              className={cn(
                active
                  ? 'text-sm text-slate-700 dark:text-slate-300'
                  : 'text-sm text-slate-600 dark:text-slate-300'
              )}
            >
              {active
                ? `Iniciado hace ${formatElapsed(session!.started_at)}`
                : 'Registra tu ruta mientras repartes o pegas propaganda.'}
            </CardDescription>
          </div>
          <Button
            variant={active ? 'destructive' : 'default'}
            size="mobile"
            className="h-11 min-h-11 shrink-0 px-3 text-sm sm:min-w-36 sm:px-5"
            disabled={busy}
            onClick={active ? handleEnd : handleStart}
          >
            {active ? 'Finalizar' : 'Iniciar recorrido'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-3', !active && 'pt-0')}>
        {active ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm sm:gap-3">
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-background/70 px-2 py-2">
                <Ruler className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate font-semibold text-foreground">
                  {formatDistance(session!.distance_m)}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-background/70 px-2 py-2">
                <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate font-semibold text-foreground">
                  {session!.sample_count} pts
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-background/70 px-2 py-2">
                <CloudUpload className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="truncate font-semibold text-foreground">
                  {pendingSamples} pend.
                </span>
              </div>
            </div>

            {!isCollecting && (
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                La captura está detenida. Finaliza y vuelve a iniciar para
                reanudar.
              </p>
            )}

            {isCollecting && !wakeLockHeld && (
              <p className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tu navegador no permite mantener la pantalla encendida. Si se
                apaga, el recorrido quedará con huecos.
              </p>
            )}
            <Link
              href="/recorridos"
              className="inline-flex min-h-11 items-center text-sm font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300"
            >
              Ver mapa del recorrido
            </Link>
          </>
        ) : (
          <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            En web el registro requiere esta pestaña abierta. Para jornadas
            largas usa la app Android.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
