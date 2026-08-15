import type { OsmTileManifest, OsmTilePack } from '@/lib/api/tiles.service';
import { kvGet, kvRemove, kvSet } from '@/lib/db/database';
import {
  assessStorageQuota,
  buildTileUrl,
  getTilesForBounds,
  type QuotaAssessment,
  type TileBounds,
} from './tile-utils';

export const OFFLINE_TILE_CACHE = 'brigada-offline-tiles-v1';
const META_PREFIX = 'offline_tiles:pack:';

export type TileDownloadState =
  | 'not_downloaded'
  | 'downloading'
  | 'paused'
  | 'complete'
  | 'incomplete'
  | 'error';

export interface TileDownloadProgress {
  packId: string;
  downloadedTiles: number;
  totalTiles: number;
  downloadedBytes: number;
  percent: number;
  state: TileDownloadState;
}

export interface OfflineTilePackStatus extends TileDownloadProgress {
  version: string;
  sizeBytes: number;
  missingTiles: number;
  updatedAt: string | null;
  error?: string;
}

interface StoredPackMetadata {
  pack: OsmTilePack;
  state: TileDownloadState;
  downloadedTiles: number;
  totalTiles: number;
  downloadedBytes: number;
  updatedAt: string;
  error?: string;
}

export class TileDownloadCancelledError extends Error {
  constructor() {
    super('La descarga de mapas fue cancelada.');
    this.name = 'TileDownloadCancelledError';
  }
}

function metadataKey(pack: Pick<OsmTilePack, 'pack_id' | 'version'>): string {
  return `${META_PREFIX}${pack.pack_id}:${pack.version}`;
}

function boundsForPack(pack: OsmTilePack): TileBounds {
  const [west, south, east, north] = pack.bbox;
  return { west, south, east, north };
}

function tileUrls(pack: OsmTilePack): string[] {
  return getTilesForBounds(boundsForPack(pack), pack.minzoom, pack.maxzoom).map((tile) =>
    buildTileUrl(pack.tiles_url_template, tile, {
      version: pack.version,
      packId: pack.pack_id,
    })
  );
}

async function readMetadata(pack: OsmTilePack): Promise<StoredPackMetadata | null> {
  const raw = await kvGet(metadataKey(pack));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPackMetadata;
  } catch {
    await kvRemove(metadataKey(pack));
    return null;
  }
}

async function writeMetadata(metadata: StoredPackMetadata): Promise<void> {
  await kvSet(metadataKey(metadata.pack), JSON.stringify(metadata));
}

function requireBrowserStorage(): void {
  if (typeof window === 'undefined' || typeof caches === 'undefined') {
    throw new Error('Las teselas offline solo están disponibles en el navegador.');
  }
}

export async function getStorageAssessment(packBytes = 0): Promise<
  QuotaAssessment & { usageBytes: number | null; quotaBytes: number | null; persistent: boolean }
> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return {
      ...assessStorageQuota({}, packBytes),
      usageBytes: null,
      quotaBytes: null,
      persistent: false,
    };
  }
  const estimate = await navigator.storage.estimate();
  const persistent = navigator.storage.persisted
    ? await navigator.storage.persisted()
    : false;
  return {
    ...assessStorageQuota(estimate, packBytes),
    usageBytes: estimate.usage ?? null,
    quotaBytes: estimate.quota ?? null,
    persistent,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

class OfflineTilesService {
  private readonly downloads = new Map<string, AbortController>();

  cancelDownload(packId: string): boolean {
    const controller = this.downloads.get(packId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async getPackStatus(pack: OsmTilePack): Promise<OfflineTilePackStatus> {
    requireBrowserStorage();
    const urls = tileUrls(pack);
    const cache = await caches.open(OFFLINE_TILE_CACHE);
    let downloadedTiles = 0;
    let downloadedBytes = 0;

    for (const url of urls) {
      const response = await cache.match(url);
      if (!response) continue;
      downloadedTiles += 1;
      downloadedBytes += Number(response.headers.get('content-length')) || 0;
    }

    const metadata = await readMetadata(pack);
    const totalTiles = urls.length;
    const complete = downloadedTiles === totalTiles && totalTiles > 0;
    const state: TileDownloadState = complete
      ? 'complete'
      : this.downloads.has(pack.pack_id)
        ? 'downloading'
        : downloadedTiles > 0
          ? metadata?.state === 'paused'
            ? 'paused'
            : 'incomplete'
          : metadata?.state === 'error' || metadata?.state === 'paused'
            ? metadata.state
            : 'not_downloaded';

    return {
      packId: pack.pack_id,
      version: pack.version,
      downloadedTiles,
      totalTiles,
      downloadedBytes,
      sizeBytes:
        downloadedBytes ||
        metadata?.downloadedBytes ||
        (complete ? pack.size_bytes ?? 0 : 0),
      missingTiles: totalTiles - downloadedTiles,
      percent: totalTiles === 0 ? 0 : Math.round((downloadedTiles / totalTiles) * 100),
      state,
      updatedAt: metadata?.updatedAt ?? null,
      error: metadata?.error,
    };
  }

  async downloadPack(
    manifest: OsmTileManifest,
    packId: string,
    onProgress?: (progress: TileDownloadProgress) => void
  ): Promise<OfflineTilePackStatus> {
    requireBrowserStorage();
    const pack = manifest.packs.find(
      (candidate) =>
        candidate.pack_id === packId && candidate.version === manifest.current_version
    );
    if (!pack) {
      throw new Error(`El pack ${packId} no pertenece a la versión actual del manifiesto.`);
    }
    if (this.downloads.has(packId)) {
      throw new Error(`El pack ${packId} ya se está descargando.`);
    }

    const quota = await getStorageAssessment(pack.size_bytes ?? 0);
    if (!quota.canDownload) {
      throw new Error(
        `No hay espacio suficiente para el mapa (faltan ${quota.shortfallBytes} bytes).`
      );
    }

    const controller = new AbortController();
    this.downloads.set(packId, controller);
    const urls = tileUrls(pack);
    const cache = await caches.open(OFFLINE_TILE_CACHE);
    let downloadedTiles = 0;
    let downloadedBytes = 0;
    let metadata: StoredPackMetadata = {
      pack,
      state: 'downloading',
      downloadedTiles: 0,
      totalTiles: urls.length,
      downloadedBytes: 0,
      updatedAt: new Date().toISOString(),
    };
    await writeMetadata(metadata);

    try {
      for (const url of urls) {
        if (controller.signal.aborted) throw new TileDownloadCancelledError();
        const existing = await cache.match(url);
        if (existing) {
          downloadedTiles += 1;
          downloadedBytes += Number(existing.headers.get('content-length')) || 0;
        } else {
          const response = await fetch(url, {
            signal: controller.signal,
            credentials: 'omit',
            mode: 'cors',
          });
          if (!response.ok) {
            throw new Error(`No se pudo descargar una tesela (${response.status}).`);
          }
          downloadedTiles += 1;
          downloadedBytes += Number(response.headers.get('content-length')) || 0;
          await cache.put(url, response);
        }

        if (downloadedTiles % 10 === 0 || downloadedTiles === urls.length) {
          metadata = {
            ...metadata,
            downloadedTiles,
            downloadedBytes,
            updatedAt: new Date().toISOString(),
          };
          await writeMetadata(metadata);
          onProgress?.({
            packId,
            downloadedTiles,
            totalTiles: urls.length,
            downloadedBytes,
            percent:
              urls.length === 0 ? 0 : Math.round((downloadedTiles / urls.length) * 100),
            state: 'downloading',
          });
        }
      }

      metadata = {
        ...metadata,
        state: 'complete',
        downloadedTiles,
        downloadedBytes,
        updatedAt: new Date().toISOString(),
        error: undefined,
      };
      await writeMetadata(metadata);
    } catch (error) {
      const cancelled =
        controller.signal.aborted || error instanceof TileDownloadCancelledError;
      metadata = {
        ...metadata,
        state: cancelled ? 'paused' : 'error',
        downloadedTiles,
        downloadedBytes,
        updatedAt: new Date().toISOString(),
        error: cancelled ? undefined : error instanceof Error ? error.message : String(error),
      };
      await writeMetadata(metadata);
      if (cancelled) throw new TileDownloadCancelledError();
      throw error;
    } finally {
      this.downloads.delete(packId);
    }

    return this.getPackStatus(pack);
  }

  async deletePack(pack: OsmTilePack): Promise<void> {
    requireBrowserStorage();
    this.cancelDownload(pack.pack_id);
    const cache = await caches.open(OFFLINE_TILE_CACHE);
    await Promise.all(tileUrls(pack).map((url) => cache.delete(url)));
    await kvRemove(metadataKey(pack));
  }

  async repairPack(
    manifest: OsmTileManifest,
    packId: string,
    onProgress?: (progress: TileDownloadProgress) => void
  ): Promise<OfflineTilePackStatus> {
    const pack = manifest.packs.find((candidate) => candidate.pack_id === packId);
    if (!pack) throw new Error(`No se encontró el pack ${packId}.`);
    const status = await this.getPackStatus(pack);
    if (status.state === 'complete') return status;
    return this.downloadPack(manifest, packId, onProgress);
  }
}

export const offlineTilesService = new OfflineTilesService();
