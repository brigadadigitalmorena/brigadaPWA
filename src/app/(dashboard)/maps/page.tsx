'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Map, RefreshCw, Shapes } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOfflineMaps } from '@/hooks/use-offline-maps';
import { useSync } from '@/contexts/sync.context';
import { cn } from '@/lib/utils';
import { TileDownloadCard } from '@/components/maps/tile-download-card';
import {
  getOsmTileManifest,
  type OsmTileManifest,
  type OsmTilePack,
} from '@/lib/api/tiles.service';
import {
  offlineTilesService,
  requestPersistentStorage,
  TileDownloadCancelledError,
  type TileDownloadProgress,
  type OfflineTilePackStatus,
} from '@/lib/services/offline-tiles.service';

const StaticMapViewer = dynamic(
  () => import('@/components/maps/static-map-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[55vh] min-h-80 place-items-center rounded-xl border bg-muted/30 text-sm text-muted-foreground">
        Cargando visor…
      </div>
    ),
  }
);

export default function MapsPage() {
  const { isOnline } = useSync();
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [tileManifest, setTileManifest] = useState<OsmTileManifest | null>(null);
  const [tileStatuses, setTileStatuses] = useState<
    Record<string, OfflineTilePackStatus>
  >({});
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const offlineMaps = useOfflineMaps(selectedMapId);

  const refreshTileStatuses = async (manifest: OsmTileManifest) => {
    const entries = await Promise.all(
      manifest.packs.map(async (pack) => [
        pack.pack_id,
        await offlineTilesService.getPackStatus(pack),
      ] as const)
    );
    setTileStatuses(Object.fromEntries(entries));
  };

  useEffect(() => {
    void getOsmTileManifest()
      .then(async (manifest) => {
        setTileManifest(manifest);
        await refreshTileStatuses(manifest);
      })
      .catch(() => {
        // The vector map remains usable even when no basemap packs are published.
      });
  }, []);

  const runTileAction = async (
    pack: OsmTilePack,
    action: 'download' | 'repair' | 'delete'
  ) => {
    if (!tileManifest) return;
    setBusyPackId(pack.pack_id);
    try {
      if (action === 'delete') {
        await offlineTilesService.deletePack(pack);
      } else {
        await requestPersistentStorage();
        const onProgress = (progress: TileDownloadProgress) => {
          setTileStatuses((current) => ({
            ...current,
            [pack.pack_id]: {
              ...current[pack.pack_id],
              ...progress,
              version: pack.version,
              sizeBytes: progress.downloadedBytes,
              missingTiles: progress.totalTiles - progress.downloadedTiles,
              updatedAt: new Date().toISOString(),
            },
          }));
        };
        if (action === 'repair') {
          await offlineTilesService.repairPack(
            tileManifest,
            pack.pack_id,
            onProgress
          );
        } else {
          await offlineTilesService.downloadPack(
            tileManifest,
            pack.pack_id,
            onProgress
          );
        }
      }
      await refreshTileStatuses(tileManifest);
      toast.success(
        action === 'delete'
          ? 'Mapa offline eliminado.'
          : 'Mapa disponible sin conexión.'
      );
    } catch (error) {
      if (!(error instanceof TileDownloadCancelledError)) {
        toast.error(
          error instanceof Error ? error.message : 'No se pudo actualizar el mapa.'
        );
      }
      await refreshTileStatuses(tileManifest);
    } finally {
      setBusyPackId(null);
    }
  };

  const handleSync = async () => {
    const result = await offlineMaps.sync();
    if (!result) return;
    if (result.status === 'error') {
      toast.error(result.error ?? 'No se pudieron sincronizar los mapas.');
    } else if (result.status === 'partial') {
      toast.warning(
        `${result.updated} actualizados y ${result.failed} con error. El cursor no avanzó.`
      );
    } else if (result.status === 'not-modified' || result.updated === 0) {
      toast.success('Los mapas ya están al día.');
    } else {
      toast.success(
        `${result.updated} mapa${result.updated === 1 ? '' : 's'} sincronizado${result.updated === 1 ? '' : 's'}.`
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapas operacionales"
        description="Consulta zonas y elementos territoriales aun sin conexión."
        action={
          <Button
            type="button"
            variant="outline"
            size="mobile"
            onClick={handleSync}
            disabled={offlineMaps.isSyncing || !isOnline}
          >
            <RefreshCw
              className={cn('h-4 w-4', offlineMaps.isSyncing && 'animate-spin')}
            />
            {offlineMaps.isSyncing ? 'Sincronizando' : 'Descargar cambios'}
          </Button>
        }
      />

      {!isOnline && (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Estás sin conexión. Puedes seguir usando los mapas ya descargados.
        </p>
      )}

      {offlineMaps.syncResult?.status === 'partial' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          No se completó la sincronización.{' '}
          {offlineMaps.syncResult.failedMaps
            .map((item) => `${item.name}: ${item.error}`)
            .join(' · ')}
        </div>
      )}

      {tileManifest && (
        <TileDownloadCard
          packs={tileManifest.packs}
          statuses={tileStatuses}
          busyPackId={busyPackId}
          onDownload={(pack) => runTileAction(pack, 'download')}
          onCancel={(pack) => {
            offlineTilesService.cancelDownload(pack.pack_id);
          }}
          onRepair={(pack) => runTileAction(pack, 'repair')}
          onDelete={(pack) => runTileAction(pack, 'delete')}
        />
      )}

      {offlineMaps.isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cargando mapas descargados…
          </CardContent>
        </Card>
      ) : offlineMaps.maps.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Sin mapas descargados"
          description="Conéctate y usa “Descargar cambios” para guardar los mapas publicados en este dispositivo."
          action={
            <Button
              type="button"
              size="mobile"
              onClick={handleSync}
              disabled={!isOnline || offlineMaps.isSyncing}
            >
              Descargar mapas
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Mapas descargados
            </h2>
            {offlineMaps.maps.map((map) => {
              const selected = map.map_id === offlineMaps.selectedMap?.map_id;
              const count = offlineMaps.featureCounts.get(map.map_id) ?? 0;
              return (
                <button
                  key={map.map_id}
                  type="button"
                  onClick={() => setSelectedMapId(map.map_id)}
                  className="block w-full text-left"
                >
                  <Card
                    className={cn(
                      'transition-colors',
                      selected
                        ? 'ring-2 ring-primary'
                        : 'hover:bg-muted/40'
                    )}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>{map.name}</CardTitle>
                        <Badge variant="outline">v{map.version}</Badge>
                      </div>
                      {map.description && (
                        <CardDescription className="line-clamp-2">
                          {map.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Shapes className="h-3.5 w-3.5" />
                      {count.toLocaleString('es-MX')} elementos
                      <span className="ml-auto">
                        {new Date(map.synced_at).toLocaleDateString('es-MX')}
                      </span>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          <Card className="min-w-0">
            <CardContent>
              {offlineMaps.selectedMap ? (
                <StaticMapViewer
                  mapName={offlineMaps.selectedMap.name}
                  features={offlineMaps.features}
                />
              ) : (
                <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">
                  Selecciona un mapa.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
