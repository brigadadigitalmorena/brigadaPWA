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
import { useFieldSession } from '@/hooks/use-field-session';
import { DEFAULT_FIELD_TRACKING } from '@/lib/api/field-session.service';

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

  return (
    <Card className={session ? 'border-green-500/40' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 md:items-center">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Navigation
                className={`h-5 w-5 ${session ? 'text-green-600' : 'text-primary'}`}
              />
              {session ? 'Recorrido en curso' : 'Recorrido'}
            </CardTitle>
            <CardDescription>
              {session
                ? `Iniciado hace ${formatElapsed(session.started_at)}`
                : 'Registra tu ruta mientras repartes o pegas propaganda.'}
            </CardDescription>
          </div>
          <Button
            variant={session ? 'destructive' : 'default'}
            size="sm"
            className="md:h-12 md:min-w-32 md:rounded-xl md:px-6 md:text-base"
            disabled={busy}
            onClick={session ? handleEnd : handleStart}
          >
            {session ? 'Finalizar' : 'Iniciar'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {session ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">
                  {formatDistance(session.distance_m)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{session.sample_count} puntos</span>
              </div>
              <div className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{pendingSamples} por enviar</span>
              </div>
            </div>

            {!isCollecting && (
              <p className="text-sm text-amber-600">
                La captura está detenida. Finaliza el recorrido y vuelve a
                iniciarlo para reanudar el registro.
              </p>
            )}

            {isCollecting && !wakeLockHeld && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tu navegador no permite mantener la pantalla encendida. Si se
                apaga, el recorrido quedará con huecos.
              </p>
            )}
            <Link href="/recorridos" className="inline-block">
              <Button type="button" variant="outline" size="sm">
                Ver mapa del recorrido
              </Button>
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            En la versión web el registro solo ocurre con esta pestaña abierta y
            visible. Para jornadas largas usa la aplicación de Android.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
