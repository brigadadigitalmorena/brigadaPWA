import type { OsmTileManifest } from './tiles.service';

/**
 * Local OSM tile manifest used when the backend has not published
 * `tiles/osm/manifest.json` in R2 (GET /mobile/tiles/osm/manifest → 404).
 *
 * Teselas públicas de OSM, misma fuente que el visor online. El bbox es
 * pequeño (centro de CDMX) para que una descarga de prueba sea viable.
 */
export const DEV_OSM_TILE_MANIFEST: OsmTileManifest = {
  dataset: 'osm',
  current_version: 'dev-local-1',
  updated_at: '2026-09-07T00:00:00.000Z',
  packs: [
    {
      version: 'dev-local-1',
      pack_id: 'cdmx-centro',
      tiles_url_template: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      minzoom: 12,
      maxzoom: 13,
      bbox: [-99.14, 19.42, -99.12, 19.44],
      size_bytes: null,
      etag: 'dev-local-1',
    },
  ],
};
