'use client';

import { useSync } from '@/contexts/sync.context';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount, lastSyncedAt } = useSync();

  return (
    <div className="flex items-center gap-3">
      {/* Online/Offline indicator */}
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {isOnline ? 'En línea' : 'Sin conexión'}
        </span>
      </div>

      {/* Sync status */}
      {isSyncing && (
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Sincronizando...
          </span>
        </div>
      )}

      {/* Pending count */}
      {pendingCount > 0 && !isSyncing && (
        <Badge variant="secondary" className="gap-1">
          <span>{pendingCount}</span>
          <span className="hidden sm:inline">pendiente{pendingCount !== 1 ? 's' : ''}</span>
        </Badge>
      )}

      {/* Last synced */}
      {lastSyncedAt && !isSyncing && pendingCount === 0 && (
        <span className="text-xs text-muted-foreground hidden md:inline">
          Última sync: {new Date(lastSyncedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
