import type { StyleSpecification } from 'maplibre-gl';

/**
 * Online raster style used by every PWA map.
 *
 * `tiles.brigadadigital.com` is the offline pack CDN and is often empty or
 * CORS-blocked; MapLibre treats a failing raster source as a blank canvas.
 * OSM is what CMS and the native app already use for interactive viewers.
 */
export const OSM_RASTER_TILES = [
  'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
];

export function createBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: OSM_RASTER_TILES,
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e8edf2' },
      },
      { id: 'osm', type: 'raster', source: 'osm' },
    ],
  };
}

export function resizeMapWhenReady(map: {
  resize: () => void;
  once: (event: 'load', handler: () => void) => void;
  getContainer?: () => HTMLElement;
}): () => void {
  const resize = () => {
    try {
      map.resize();
    } catch {
      // Map already removed.
    }
  };
  map.once('load', resize);
  const frame =
    typeof window !== 'undefined' ? window.requestAnimationFrame(resize) : 0;
  const container = map.getContainer?.();
  const observer =
    container && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null;
  observer?.observe(container as HTMLElement);
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    observer?.disconnect();
  };
}
