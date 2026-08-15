import type { StaticMapFeature } from '@/lib/db/database';

export type Position = [number, number, ...number[]];

export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'MultiPoint'; coordinates: Position[] }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }
  | { type: 'GeometryCollection'; geometries: GeoJsonGeometry[] };

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: GeoJsonGeometry;
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export type GeoJsonBbox = [number, number, number, number];

export function emptyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function parseRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function featureCollectionFromRows(
  rows: StaticMapFeature[]
): FeatureCollection {
  const features: GeoJsonFeature[] = [];
  for (const row of rows) {
    try {
      const geometry = JSON.parse(row.geometry_json) as GeoJsonGeometry;
      if (!geometry || typeof geometry.type !== 'string') continue;
      features.push({
        type: 'Feature',
        id: row.feature_key,
        geometry,
        properties: {
          ...parseRecord(row.properties_json),
          featureKey: row.feature_key,
          featureId: row.feature_id,
          layerId: row.layer_id,
          layerName: row.layer_name,
          layerType: row.layer_type,
        },
      });
    } catch {
      // One corrupt local row must not prevent the remaining map from rendering.
    }
  }
  return { type: 'FeatureCollection', features };
}

function visitCoordinates(value: unknown, visit: (lng: number, lat: number) => void) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    visit(value[0], value[1]);
    return;
  }
  for (const child of value) visitCoordinates(child, visit);
}

function visitGeometry(
  geometry: GeoJsonGeometry,
  visit: (lng: number, lat: number) => void
) {
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) visitGeometry(child, visit);
  } else {
    visitCoordinates(geometry.coordinates, visit);
  }
}

export function bboxForFeatureCollection(
  collection: FeatureCollection
): GeoJsonBbox | null {
  let bbox: GeoJsonBbox | null = null;
  for (const feature of collection.features) {
    visitGeometry(feature.geometry, (lng, lat) => {
      bbox = bbox
        ? [
            Math.min(bbox[0], lng),
            Math.min(bbox[1], lat),
            Math.max(bbox[2], lng),
            Math.max(bbox[3], lat),
          ]
        : [lng, lat, lng, lat];
    });
  }
  return bbox;
}

export function splitByGeometry(collection: FeatureCollection): {
  polygons: FeatureCollection;
  lines: FeatureCollection;
  points: FeatureCollection;
  unsupported: FeatureCollection;
} {
  const polygons = emptyFeatureCollection();
  const lines = emptyFeatureCollection();
  const points = emptyFeatureCollection();
  const unsupported = emptyFeatureCollection();

  for (const feature of collection.features) {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      polygons.features.push(feature);
    } else if (
      feature.geometry.type === 'LineString' ||
      feature.geometry.type === 'MultiLineString'
    ) {
      lines.features.push(feature);
    } else if (
      feature.geometry.type === 'Point' ||
      feature.geometry.type === 'MultiPoint'
    ) {
      points.features.push(feature);
    } else {
      unsupported.features.push(feature);
    }
  }

  return { polygons, lines, points, unsupported };
}
