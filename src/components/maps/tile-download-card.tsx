'use client';

import { Download, HardDrive, Pause, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { OsmTilePack } from '@/lib/api/tiles.service';
import type { OfflineTilePackStatus } from '@/lib/services/offline-tiles.service';

export interface TileDownloadCardProps {
  packs: OsmTilePack[];
  statuses: Record<string, OfflineTilePackStatus | undefined>;
  busyPackId?: string | null;
  onDownload: (pack: OsmTilePack) => void | Promise<void>;
  onCancel: (pack: OsmTilePack) => void | Promise<void>;
  onRepair: (pack: OsmTilePack) => void | Promise<void>;
  onDelete: (pack: OsmTilePack) => void | Promise<void>;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return 'Tamaño no disponible';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unit).toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
}

function statusLabel(status?: OfflineTilePackStatus): string {
  switch (status?.state) {
    case 'complete':
      return 'Disponible sin conexión';
    case 'downloading':
      return `Descargando ${status.percent}%`;
    case 'paused':
      return `Pausado en ${status.percent}%`;
    case 'incomplete':
      return `Incompleto (${status.percent}%)`;
    case 'error':
      return 'Necesita reparación';
    default:
      return 'No descargado';
  }
}

export function TileDownloadCard({
  packs,
  statuses,
  busyPackId,
  onDownload,
  onCancel,
  onRepair,
  onDelete,
}: TileDownloadCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="size-5 text-primary" />
          Mapas sin conexión
        </CardTitle>
        <CardDescription>
          Descarga una zona antes de salir a campo. La PWA podrá mostrar sus teselas
          aunque no haya señal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {packs.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay zonas disponibles.</p>
        )}

        {packs.map((pack) => {
          const status = statuses[pack.pack_id];
          const busy = busyPackId === pack.pack_id || status?.state === 'downloading';
          const hasTiles = Boolean(status && status.downloadedTiles > 0);
          const complete = status?.state === 'complete';

          return (
            <div key={`${pack.pack_id}:${pack.version}`} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{pack.pack_id}</p>
                  <p className="text-xs text-muted-foreground">
                    Zoom {pack.minzoom}–{pack.maxzoom} · {formatBytes(pack.size_bytes)}
                  </p>
                </div>
                <span className="text-right text-xs text-muted-foreground">
                  {statusLabel(status)}
                </span>
              </div>

              {status && status.totalTiles > 0 && (
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`Descarga de ${pack.pack_id}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={status.percent}
                >
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${status.percent}%` }}
                  />
                </div>
              )}

              {status?.error && (
                <p className="text-xs text-destructive">{status.error}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {busy ? (
                  <Button size="sm" variant="outline" onClick={() => onCancel(pack)}>
                    <Pause />
                    Pausar
                  </Button>
                ) : !complete ? (
                  <Button size="sm" onClick={() => onDownload(pack)}>
                    <Download />
                    {hasTiles ? 'Reanudar' : 'Descargar'}
                  </Button>
                ) : null}

                {hasTiles && !busy && !complete && (
                  <Button size="sm" variant="outline" onClick={() => onRepair(pack)}>
                    <RefreshCw />
                    Reparar
                  </Button>
                )}
                {hasTiles && !busy && (
                  <Button size="sm" variant="destructive" onClick={() => onDelete(pack)}>
                    <Trash2 />
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
