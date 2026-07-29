'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/contexts/sync.context';
import { db } from '@/lib/db/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { InlineBanner } from '@/components/ui/inline-banner';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSyncErrorCopy } from '@/lib/sync/error-copy';

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pendiente';
    case 'retry_wait':
      return 'Reintento';
    case 'leased':
    case 'syncing':
      return 'Enviando';
    case 'completed':
      return 'Enviado';
    case 'dead_letter':
    case 'failed_permanent':
    case 'failed':
      return 'Con error';
    case 'discarded':
      return 'Descartado';
    default:
      return status;
  }
}

export default function SyncPage() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    deadLetterCount,
    lastSyncedAt,
    error,
    syncNow,
    retryFailed,
    clearDeadLetter,
  } = useSync();

  const queueItems = useLiveQuery(async () => {
    const rows = await db.sync_queue
      .filter((item) => item.status !== 'completed' && item.status !== 'discarded')
      .toArray();
    return rows
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 50);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Envíos"
        description="Estado de tus envíos pendientes"
      />

      {!isOnline && (
        <InlineBanner
          variant="warning"
          message="Sin conexión. Los envíos se reintentarán al recuperar red."
        />
      )}

      {(deadLetterCount ?? 0) > 0 && (
        <InlineBanner
          variant="error"
          message={`${deadLetterCount} envío(s) con error. Revisa el detalle abajo o reintenta.`}
        />
      )}

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  isOnline ? 'bg-green-500/10' : 'bg-red-500/10'
                )}
              >
                {isOnline ? (
                  <Wifi className="h-7 w-7 text-green-500" />
                ) : (
                  <WifiOff className="h-7 w-7 text-red-500" />
                )}
              </div>
              <div>
                <span className="text-xl">{isOnline ? 'En línea' : 'Sin conexión'}</span>
                <CardDescription className="mt-0.5">
                  {isOnline ? 'Conectado al servidor' : 'Modo offline'}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <RefreshCw
                  className={cn('h-7 w-7 text-primary', isSyncing && 'animate-spin')}
                />
              </div>
              <div>
                <span className="text-3xl font-bold">{pendingCount}</span>
                <CardDescription className="mt-0.5">
                  {pendingCount === 0
                    ? 'Nada pendiente'
                    : `${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={syncNow}
              disabled={!isOnline || isSyncing || (pendingCount === 0 && (deadLetterCount ?? 0) === 0)}
              size="mobile"
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Sincronizar ahora
                </>
              )}
            </Button>
            {(deadLetterCount ?? 0) > 0 && (
              <div className="flex gap-2">
                <Button onClick={retryFailed} variant="outline" size="sm" className="flex-1">
                  Reintentar fallidos
                </Button>
                <Button onClick={clearDeadLetter} variant="ghost" size="sm" className="flex-1">
                  Descartar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <span className="text-xl">Última sync</span>
                <CardDescription className="mt-0.5">
                  {lastSyncedAt
                    ? new Date(lastSyncedAt).toLocaleString()
                    : 'Nunca'}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error de sincronización
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={retryFailed} variant="outline" size="mobile" className="w-full">
              Reintentar fallidos
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Detalle de cola</h2>
        {!queueItems || queueItems.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No hay envíos pendientes ni con error.
            </CardContent>
          </Card>
        ) : (
          queueItems.map((item) => {
            const copy = getSyncErrorCopy(item.last_error_code);
            const isError = ['dead_letter', 'failed_permanent', 'failed', 'retry_wait'].includes(
              item.status
            );

            return (
              <Card
                key={item.queue_id}
                className={cn(isError && item.status !== 'retry_wait' && 'border-destructive/40')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span>
                      {item.operation_type === 'CREATE_RESPONSE'
                        ? 'Respuesta'
                        : item.operation_type === 'UPLOAD_FILE'
                          ? 'Archivo'
                          : item.operation_type}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {statusLabel(item.status)}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs break-all">
                    {item.entity_id}
                  </CardDescription>
                </CardHeader>
                {(item.last_error || item.last_error_code) && (
                  <CardContent className="pt-0 text-sm space-y-1">
                    <p className="font-medium text-destructive">{copy.title}</p>
                    <p className="text-muted-foreground">
                      {item.last_error || copy.body || copy.action}
                    </p>
                    {item.retry_count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Intentos: {item.retry_count}/{item.max_retries}
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
