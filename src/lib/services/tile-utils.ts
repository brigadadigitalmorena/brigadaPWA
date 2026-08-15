export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface TileBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

const MAX_MERCATOR_LATITUDE = 85.05112878;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function longitudeToTileX(longitude: number, zoom: number): number {
  const tileCount = 2 ** zoom;
  return clamp(Math.floor(((longitude + 180) / 360) * tileCount), 0, tileCount - 1);
}

export function latitudeToTileY(latitude: number, zoom: number): number {
  const radians =
    (clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE) * Math.PI) / 180;
  const tileCount = 2 ** zoom;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
      tileCount
  );
  return clamp(y, 0, tileCount - 1);
}

export function getTilesForBounds(
  bounds: TileBounds,
  minZoom: number,
  maxZoom: number
): TileCoordinate[] {
  if (bounds.west > bounds.east) {
    throw new Error('Los límites que cruzan el antimeridiano no están soportados.');
  }
  if (bounds.south > bounds.north || minZoom < 0 || maxZoom < minZoom) {
    throw new Error('Límites o niveles de zoom inválidos.');
  }

  const tiles: TileCoordinate[] = [];
  for (let z = Math.floor(minZoom); z <= Math.floor(maxZoom); z += 1) {
    const xMin = longitudeToTileX(bounds.west, z);
    const xMax = longitudeToTileX(bounds.east, z);
    const yMin = latitudeToTileY(bounds.north, z);
    const yMax = latitudeToTileY(bounds.south, z);
    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

export function buildTileUrl(
  template: string,
  tile: TileCoordinate,
  options: { version?: string; packId?: string } = {}
): string {
  return template
    .replaceAll('{z}', String(tile.z))
    .replaceAll('{x}', String(tile.x))
    .replaceAll('{y}', String(tile.y))
    .replaceAll('{version}', encodeURIComponent(options.version ?? ''))
    .replaceAll('{pack_id}', encodeURIComponent(options.packId ?? ''));
}

export interface QuotaAssessment {
  canDownload: boolean;
  availableBytes: number | null;
  requiredBytes: number;
  shortfallBytes: number;
}

export function assessStorageQuota(
  estimate: { quota?: number; usage?: number },
  packBytes: number,
  reservedBytes = 20 * 1024 * 1024
): QuotaAssessment {
  const requiredBytes = Math.max(0, packBytes);
  if (!Number.isFinite(estimate.quota)) {
    return { canDownload: true, availableBytes: null, requiredBytes, shortfallBytes: 0 };
  }

  const availableBytes = Math.max(
    0,
    (estimate.quota as number) - (estimate.usage ?? 0) - Math.max(0, reservedBytes)
  );
  return {
    canDownload: availableBytes >= requiredBytes,
    availableBytes,
    requiredBytes,
    shortfallBytes: Math.max(0, requiredBytes - availableBytes),
  };
}
