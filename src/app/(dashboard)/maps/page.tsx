'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Map, RefreshCw, Shapes } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOfflineMaps } from '@/hooks/use-offline-maps';
import { useSync } from '@/contexts/sync.context';
import { useTheme } from '@/contexts/theme-context';
import { getColorScheme } from '@/lib/color-schemes';
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
      <div className="grid h-[min(70dvh,40rem)] min-h-72 place-items-center rounded-xl border bg-muted/30 text-sm text-muted-foreground sm:min-h-[28rem]">
        Cargando visor…
      </div>
    ),
  }
);

export default function MapsPage() {
  const { isOnline } = useSync();
  const { colorScheme, theme, mounted: themeMounted } = useTheme();
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [tileManifest, setTileManifest] = useState<OsmTileManifest | null>(null);
  const [tileStatuses, setTileStatuses] = useState<
    Record<string, OfflineTilePackStatus>
  >({});
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const offlineMaps = useOfflineMaps(selectedMapId);
  const viewerSectionRef = useRef<HTMLDivElement>(null);
  const didAutoSync = useRef(false);

  const accentColor = (() => {
    const scheme = getColorScheme(colorScheme);
    if (!scheme) return undefined;
    if (!themeMounted) return scheme.swatchLight;
    return theme === 'dark' ? scheme.swatchDark : scheme.swatchLight;
  })();

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

  // Pull the full CMS catalog when entering Mapas so published / unpublished
  // changes appear without relying only on the delta publication cursor.
  useEffect(() => {
    if (!isOnline || didAutoSync.current || offlineMaps.isSyncing) return;
    didAutoSync.current = true;
    void offlineMaps.sync({ forceFull: true }).then((result) => {
      if (!result) return;
      if (result.status === 'error') {
        toast.error(result.error ?? 'No se pudieron sincronizar los mapas.');
        return;
      }
      if (result.status === 'partial') {
        toast.warning(
          `${result.updated} actualizados y ${result.failed} con error.`
        );
        return;
      }
      if (result.updated > 0 || result.removed > 0) {
        const parts: string[] = [];
        if (result.updated > 0) {
          parts.push(
            `${result.updated} mapa${result.updated === 1 ? '' : 's'} actualizado${result.updated === 1 ? '' : 's'}`
          );
        }
        if (result.removed > 0) {
          parts.push(
            `${result.removed} retirado${result.removed === 1 ? '' : 's'}`
          );
        }
        toast.success(parts.join(' · '));
      }
    });
    // Intentionally once per visit while online.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

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
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar el mapa.'
        );
      }
      await refreshTileStatuses(tileManifest);
    } finally {
      setBusyPackId(null);
    }
  };

  const handleSync = async () => {
    const result = await offlineMaps.sync({ forceFull: true });
    if (!result) return;
    if (result.status === 'error') {
      toast.error(result.error ?? 'No se pudieron sincronizar los mapas.');
    } else if (result.status === 'partial') {
      toast.warning(
        `${result.updated} actualizados y ${result.failed} con error. El cursor no avanzó.`
      );
    } else if (
      result.status === 'not-modified' ||
      (result.updated === 0 && result.removed === 0)
    ) {
      toast.success('Los mapas ya están al día.');
    } else {
      const parts: string[] = [];
      if (result.updated > 0) {
        parts.push(
          `${result.updated} mapa${result.updated === 1 ? '' : 's'} sincronizado${result.updated === 1 ? '' : 's'}`
        );
      }
      if (result.removed > 0) {
        parts.push(
          `${result.removed} retirado${result.removed === 1 ? '' : 's'}`
        );
      }
      toast.success(parts.join(' · '));
    }
  };

  const selectMap = (mapId: number) => {
    setSelectedMapId(mapId);
    window.requestAnimationFrame(() => {
      viewerSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  };

  const activeMapId =
    selectedMapId ?? offlineMaps.selectedMap?.map_id ?? null;

  return (
    <div className="space-y-4 sm:space-y-5">
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
          defaultCollapsed
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
        <div className="grid gap-4 lg:grid-cols-[minmax(13rem,22%)_minmax(0,1fr)] lg:items-start lg:gap-5">
          {/* Mobile: horizontal chips. Desktop: compact vertical list. */}
          <section className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Mapas descargados
              </h2>
              <span className="text-xs text-muted-foreground">
                {offlineMaps.maps.length}
              </span>
            </div>

            <div
              className={cn(
                'flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                'lg:flex-col lg:overflow-visible lg:pb-0'
              )}
            >
              {offlineMaps.maps.map((map) => {
                const selected = map.map_id === activeMapId;
                const count = offlineMaps.featureCounts.get(map.map_id) ?? 0;
                return (
                  <button
                    key={map.map_id}
                    type="button"
                    onClick={() => selectMap(map.map_id)}
                    aria-pressed={selected}
                    className={cn(
                      'shrink-0 rounded-xl border-2 bg-card text-left transition-[border-color,box-shadow,background-color] duration-200',
                      'w-[min(78vw,18rem)] p-3 lg:w-full lg:p-3',
                      selected
                        ? 'bg-primary/5 shadow-sm'
                        : 'border-transparent hover:bg-muted/40'
                    )}
                    style={
                      selected && accentColor
                        ? {
                            borderColor: accentColor,
                            boxShadow: `0 0 0 1px ${accentColor}33`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug">
                        {map.name}
                      </p>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        v{map.version}
                      </Badge>
                    </div>
                    {map.description ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {map.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Shapes className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {count.toLocaleString('es-MX')} elem.
                      </span>
                      <span className="ml-auto shrink-0">
                        {new Date(map.synced_at).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <Card
            ref={viewerSectionRef}
            id="mapa-visor"
            className="min-w-0 scroll-mt-20 lg:sticky lg:top-2"
          >
            <CardContent className="p-2.5 sm:p-4">
              {offlineMaps.selectedMap ? (
                <StaticMapViewer
                  key={offlineMaps.selectedMap.map_id}
                  mapName={offlineMaps.selectedMap.name}
                  features={offlineMaps.features}
                />
              ) : (
                <div className="grid h-[min(70dvh,40rem)] min-h-72 place-items-center text-sm text-muted-foreground sm:min-h-[28rem]">
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
