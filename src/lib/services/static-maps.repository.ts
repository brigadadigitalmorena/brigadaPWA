import {
  db,
  type StaticMap,
  type StaticMapFeature,
} from '@/lib/db/database';

export interface StaticMapFeatureInput {
  feature_id: number;
  map_id: number;
  layer_id: number;
  layer_name: string;
  layer_type: string;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown> | null;
}

function featureKey(feature: StaticMapFeatureInput): string {
  return `${feature.map_id}:${feature.layer_id}:${feature.feature_id}`;
}

export const staticMapsRepository = {
  listMaps(): Promise<StaticMap[]> {
    return db.static_maps.orderBy('name').toArray();
  },

  getMap(mapId: number): Promise<StaticMap | undefined> {
    return db.static_maps.get(mapId);
  },

  getFirstMap(): Promise<StaticMap | undefined> {
    return db.static_maps.orderBy('name').first();
  },

  getFeatures(mapId: number): Promise<StaticMapFeature[]> {
    return db.static_map_features.where('map_id').equals(mapId).sortBy('layer_id');
  },

  async getFeatureCounts(): Promise<Map<number, number>> {
    const rows = await db.static_map_features.toArray();
    const counts = new Map<number, number>();
    for (const row of rows) {
      counts.set(row.map_id, (counts.get(row.map_id) ?? 0) + 1);
    }
    return counts;
  },

  async getLocalVersion(mapId: number): Promise<number | null> {
    return (await db.static_maps.get(mapId))?.version ?? null;
  },

  /**
   * Metadata and its complete feature set become visible atomically. A failed
   * insert leaves the previous downloaded map usable.
   */
  async replaceMap(
    map: StaticMap,
    features: StaticMapFeatureInput[]
  ): Promise<void> {
    const rows: StaticMapFeature[] = features.map((feature) => ({
      feature_key: featureKey(feature),
      feature_id: feature.feature_id,
      map_id: feature.map_id,
      layer_id: feature.layer_id,
      layer_name: feature.layer_name,
      layer_type: feature.layer_type,
      geometry_json: JSON.stringify(feature.geometry),
      properties_json:
        feature.properties === null ? null : JSON.stringify(feature.properties),
    }));

    await db.transaction(
      'rw',
      db.static_maps,
      db.static_map_features,
      async () => {
        await db.static_map_features.where('map_id').equals(map.map_id).delete();
        if (rows.length > 0) await db.static_map_features.bulkPut(rows);
        await db.static_maps.put(map);
      }
    );
  },
};
