'use client';

import { useSync } from '@/contexts/sync.context';
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Envíos"
        description="Cola de sincronización y estado de envíos"
      />

      {!isOnline && (
        <InlineBanner
          variant="warning"
          message="Sin conexión a internet. Puedes seguir trabajando; los datos se sincronizarán cuando recuperes la conexión."
        />
      )}

      {(deadLetterCount ?? 0) > 0 && (
        <InlineBanner
          variant="error"
          message={`${deadLetterCount} envío(s) con error. Reintenta o descarta tras revisar el problema.`}
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
                  {isOnline
                    ? 'Conectado al servidor'
                    : 'Trabajando en modo offline'}
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
                  className={cn(
                    'h-7 w-7 text-primary',
                    isSyncing && 'animate-spin'
                  )}
                />
              </div>
              <div>
                <span className="text-3xl font-bold">{pendingCount}</span>
                <CardDescription className="mt-0.5">
                  {pendingCount === 0
                    ? 'Todo sincronizado'
                    : `${pendingCount} elemento${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`}
                </CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={syncNow}
              disabled={!isOnline || isSyncing || pendingCount === 0}
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
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button onClick={retryFailed} variant="outline" size="mobile" className="flex-1">
              Reintentar fallidos
            </Button>
            <Button onClick={syncNow} size="mobile" className="flex-1">
              Sincronizar de nuevo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
