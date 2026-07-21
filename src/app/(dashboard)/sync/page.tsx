'use client';

import { useSync } from '@/contexts/sync.context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SyncPage() {
  const { 
    isOnline, 
    isSyncing, 
    pendingCount, 
    lastSyncedAt, 
    error,
    syncNow,
    retryFailed,
    clearDeadLetter
  } = useSync();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sincronización</h1>
        <p className="text-muted-foreground">
          Estado de sincronización de datos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <Wifi className="h-5 w-5 text-green-500" />
                  En línea
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-500" />
                  Sin conexión
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isOnline
                ? 'Conectado al servidor'
                : 'Trabajando en modo offline'}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pending Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
              {pendingCount}
            </CardTitle>
            <CardDescription>
              {pendingCount === 0
                ? 'Todo sincronizado'
                : `${pendingCount} elemento${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={syncNow}
              disabled={!isOnline || isSyncing || pendingCount === 0}
              className="w-full"
            >
              {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </Button>
          </CardContent>
        </Card>

        {/* Last Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Última sync
            </CardTitle>
            <CardDescription>
              {lastSyncedAt
                ? new Date(lastSyncedAt).toLocaleString()
                : 'Nunca'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error de sincronización
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={retryFailed} variant="outline">
              Reintentar fallidos
            </Button>
            <Button onClick={syncNow}>
              Sincronizar de nuevo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>¿Cómo funciona la sincronización?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <strong>Modo Offline:</strong> Puedes trabajar sin conexión. Los datos se guardan localmente y se sincronizan automáticamente cuando recuperes la conexión.
          </p>
          <p>
            <strong>Sincronización automática:</strong> Cuando estás en línea, los datos pendientes se sincronizan automáticamente en segundo plano.
          </p>
          <p>
            <strong>Reintentos:</strong> Si una sincronización falla, se reintentará automáticamente con intervalos crecientes.
          </p>
          <p>
            <strong>Cola de sincronización:</strong> Los elementos pendientes se procesan en orden de prioridad.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
