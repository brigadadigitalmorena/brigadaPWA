import apiClient from './client';

export interface OsmTilePack {
  version: string;
  pack_id: string;
  tiles_url_template: string;
  minzoom: number;
  maxzoom: number;
  /** Backend order: [west, south, east, north]. */
  bbox: [number, number, number, number];
  size_bytes?: number | null;
  etag?: string | null;
}

export interface OsmTileManifest {
  dataset: string;
  current_version: string;
  updated_at: string;
  packs: OsmTilePack[];
}

export async function getOsmTileManifest(): Promise<OsmTileManifest> {
  const response = await apiClient.get<OsmTileManifest>('/mobile/tiles/osm/manifest');
  return response.data;
}
