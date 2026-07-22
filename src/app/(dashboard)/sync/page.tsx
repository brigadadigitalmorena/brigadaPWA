'use client';

import { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SyncPage() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    error,
    syncNow,
    retryFailed,
  } = useSync();

  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sincronización"
        description="Estado de sincronización de datos"
      />

      {!isOnline && (
        <InlineBanner
          variant="warning"
          message="Sin conexión a internet. Puedes seguir trabajando; los datos se sincronizarán cuando recuperes la conexión."
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
          <CardContent>
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

      <Card>
        <button
          type="button"
          onClick={() => setInfoOpen(!infoOpen)}
          className="w-full flex items-center justify-between p-6 text-left touch-target"
        >
          <CardTitle className="text-base">¿Cómo funciona la sincronización?</CardTitle>
          {infoOpen ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {infoOpen && (
          <CardContent className="space-y-4 text-sm text-muted-foreground pt-0">
            <p>
              <strong className="text-foreground">Modo Offline:</strong> Puedes trabajar sin conexión. Los datos se guardan localmente y se sincronizan automáticamente cuando recuperes la conexión.
            </p>
            <p>
              <strong className="text-foreground">Sincronización automática:</strong> Cuando estás en línea, los datos pendientes se sincronizan automáticamente en segundo plano.
            </p>
            <p>
              <strong className="text-foreground">Reintentos:</strong> Si una sincronización falla, se reintentará automáticamente con intervalos crecientes.
            </p>
            <p>
              <strong className="text-foreground">Cola de sincronización:</strong> Los elementos pendientes se procesan en orden de prioridad.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
