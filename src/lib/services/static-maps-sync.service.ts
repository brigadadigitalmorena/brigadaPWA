import {
  getMobileMaps,
  type MobileMapSyncItem,
} from '@/lib/api/maps.service';
import { kvGet, kvSet } from '@/lib/db/database';
import {
  staticMapsRepository,
  type StaticMapFeatureInput,
} from './static-maps.repository';

const MAPS_ETAG_KEY = 'static_maps_server_etag';
const MAPS_LAST_SYNC_KEY = 'static_maps_last_sync';

async function recordSyncMetric(
  status: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await kvSet(
      MAPS_LAST_SYNC_KEY,
      JSON.stringify({
        status,
        ...details,
        recorded_at: new Date().toISOString(),
      })
    );
  } catch {
    // Diagnostics must never make a map update fail.
  }
}

interface ManifestFeature {
  id: number;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown> | null;
}

interface ManifestLayer {
  id: number;
  name: string;
  layer_type: string;
  features: ManifestFeature[];
}

interface StaticMapManifest {
  map_id: number;
  version: number;
  etag: string;
  name: string;
  description: string | null;
  published_at: string;
  layers: ManifestLayer[];
}

export interface StaticMapsSyncResult {
  status: 'updated' | 'not-modified' | 'partial' | 'error';
  updated: number;
  skipped: number;
  failed: number;
  failedMaps: Array<{ mapId: number; name: string; error: string }>;
  serverEtag?: string;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseManifest(value: unknown, item: MobileMapSyncItem): StaticMapManifest {
  if (!isRecord(value) || !Array.isArray(value.layers)) {
    throw new Error('El manifiesto no contiene una lista de capas válida.');
  }
  if (value.map_id !== item.map_id || value.version !== item.version) {
    throw new Error('El manifiesto no corresponde al mapa o versión solicitada.');
  }
  if (typeof value.etag !== 'string' || value.etag !== item.manifest_etag) {
    throw new Error('El etag del manifiesto no coincide con la publicación.');
  }

  const layers: ManifestLayer[] = value.layers.map((rawLayer, layerIndex) => {
    if (
      !isRecord(rawLayer) ||
      typeof rawLayer.id !== 'number' ||
      typeof rawLayer.name !== 'string' ||
      typeof rawLayer.layer_type !== 'string' ||
      !Array.isArray(rawLayer.features)
    ) {
      throw new Error(`La capa ${layerIndex + 1} tiene una forma inválida.`);
    }

    const features: ManifestFeature[] = rawLayer.features.map(
      (rawFeature, featureIndex) => {
        if (
          !isRecord(rawFeature) ||
          typeof rawFeature.id !== 'number' ||
          !isRecord(rawFeature.geometry) ||
          typeof rawFeature.geometry.type !== 'string' ||
          !('coordinates' in rawFeature.geometry ||
            rawFeature.geometry.type === 'GeometryCollection') ||
          (rawFeature.properties !== null &&
            rawFeature.properties !== undefined &&
            !isRecord(rawFeature.properties))
        ) {
          throw new Error(
            `La feature ${featureIndex + 1} de "${rawLayer.name}" es inválida.`
          );
        }
        return {
          id: rawFeature.id,
          geometry: rawFeature.geometry,
          properties: isRecord(rawFeature.properties)
            ? rawFeature.properties
            : null,
        };
      }
    );

    return {
      id: rawLayer.id,
      name: rawLayer.name,
      layer_type: rawLayer.layer_type,
      features,
    };
  });

  return {
    map_id: value.map_id as number,
    version: value.version as number,
    etag: value.etag as string,
    name: typeof value.name === 'string' ? value.name : item.name,
    description:
      typeof value.description === 'string' ? value.description : item.description,
    published_at:
      typeof value.published_at === 'string'
        ? value.published_at
        : item.published_at,
    layers,
  };
}

async function downloadManifest(
  item: MobileMapSyncItem,
  signal?: AbortSignal
): Promise<StaticMapManifest> {
  if (!item.manifest_url) throw new Error('La publicación no tiene manifest_url.');
  const response = await fetch(item.manifest_url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`No se pudo descargar el manifiesto (HTTP ${response.status}).`);
  }
  return parseManifest(await response.json(), item);
}

async function syncOneMap(
  item: MobileMapSyncItem,
  signal?: AbortSignal
): Promise<'updated' | 'skipped'> {
  const local = await staticMapsRepository.getMap(item.map_id);
  if (
    local &&
    local.version === item.version &&
    local.manifest_etag === item.manifest_etag
  ) {
    return 'skipped';
  }

  const manifest = await downloadManifest(item, signal);
  const features: StaticMapFeatureInput[] = manifest.layers.flatMap((layer) =>
    layer.features.map((feature) => ({
      feature_id: feature.id,
      map_id: item.map_id,
      layer_id: layer.id,
      layer_name: layer.name,
      layer_type: layer.layer_type,
      geometry: feature.geometry,
      properties: feature.properties,
    }))
  );

  await staticMapsRepository.replaceMap(
    {
      map_id: item.map_id,
      name: item.name,
      description: item.description,
      version: item.version,
      manifest_etag: item.manifest_etag,
      published_at: item.published_at,
      synced_at: new Date().toISOString(),
    },
    features
  );
  return 'updated';
}

export async function syncStaticMaps(
  signal?: AbortSignal
): Promise<StaticMapsSyncResult> {
  try {
    const cursor = await kvGet(MAPS_ETAG_KEY);
    const response = await getMobileMaps(cursor ?? undefined, signal);
    if (response.status === 'not-modified') {
      await recordSyncMetric('not-modified');
      return {
        status: 'not-modified',
        updated: 0,
        skipped: 0,
        failed: 0,
        failedMaps: [],
        serverEtag: cursor ?? undefined,
      };
    }

    let updated = 0;
    let skipped = 0;
    const failedMaps: StaticMapsSyncResult['failedMaps'] = [];
    for (const item of response.data.maps) {
      try {
        const outcome = await syncOneMap(item, signal);
        if (outcome === 'updated') updated += 1;
        else skipped += 1;
      } catch (error) {
        failedMaps.push({
          mapId: item.map_id,
          name: item.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (failedMaps.length === 0) {
      await kvSet(MAPS_ETAG_KEY, response.data.server_etag);
    }
    await recordSyncMetric(failedMaps.length > 0 ? 'partial' : 'updated', {
      updated,
      skipped,
      failed: failedMaps.length,
    });

    return {
      status: failedMaps.length > 0 ? 'partial' : 'updated',
      updated,
      skipped,
      failed: failedMaps.length,
      failedMaps,
      serverEtag: response.data.server_etag,
    };
  } catch (error) {
    await recordSyncMetric('error', {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 'error',
      updated: 0,
      skipped: 0,
      failed: 0,
      failedMaps: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
