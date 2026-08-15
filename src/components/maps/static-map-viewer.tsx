'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StaticMapFeature } from '@/lib/db/database';
import {
  bboxForFeatureCollection,
  featureCollectionFromRows,
  splitByGeometry,
} from '@/lib/maps/geojson';
import { createBasemapStyle, resizeMapWhenReady } from '@/lib/maps/basemap-style';
import { Button } from '@/components/ui/button';
import { LocateFixed, X } from 'lucide-react';

interface StaticMapViewerProps {
  mapName: string;
  features: StaticMapFeature[];
}

type SelectedFeature = {
  source: string;
  id: string | number;
  properties: Record<string, unknown>;
};

const SOURCE_DATA: Array<{
  source: string;
  dataKey: 'polygons' | 'lines' | 'points';
}> = [
  { source: 'offline-polygons', dataKey: 'polygons' },
  { source: 'offline-lines', dataKey: 'lines' },
  { source: 'offline-points', dataKey: 'points' },
];

export default function StaticMapViewer({
  mapName,
  features,
}: StaticMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const geolocateRef = useRef<import('maplibre-gl').GeolocateControl | null>(null);
  const selectedRef = useRef<SelectedFeature | null>(null);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collection = useMemo(() => featureCollectionFromRows(features), [features]);
  const buckets = useMemo(() => splitByGeometry(collection), [collection]);
  const bbox = useMemo(() => bboxForFeatureCollection(collection), [collection]);

  useEffect(() => {
    let cancelled = false;
    let detachResize: (() => void) | undefined;
    async function initialize() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: createBasemapStyle(),
          center: [-98.2063, 19.0414],
          zoom: 10,
          attributionControl: false,
        });
        detachResize = resizeMapWhenReady(map);
        const geolocate = new maplibregl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserLocation: true,
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(geolocate, 'top-right');
        geolocateRef.current = geolocate;

        map.on('load', () => {
          for (const entry of SOURCE_DATA) {
            map.addSource(entry.source, {
              type: 'geojson',
              data: buckets[entry.dataKey] as never,
              promoteId: 'featureKey',
            });
          }
          map.addLayer({
            id: 'offline-polygon-fill',
            source: 'offline-polygons',
            type: 'fill',
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#f59e0b',
                '#2563eb',
              ],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                0.55,
                0.24,
              ],
            },
          });
          map.addLayer({
            id: 'offline-polygon-outline',
            source: 'offline-polygons',
            type: 'line',
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#b45309',
                '#1d4ed8',
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                4,
                2,
              ],
            },
          });
          map.addLayer({
            id: 'offline-line',
            source: 'offline-lines',
            type: 'line',
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#f59e0b',
                '#0f766e',
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                6,
                3,
              ],
            },
          });
          map.addLayer({
            id: 'offline-point',
            source: 'offline-points',
            type: 'circle',
            paint: {
              'circle-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#f59e0b',
                '#dc2626',
              ],
              'circle-radius': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                9,
                6,
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });

          const selectableLayers = [
            'offline-polygon-fill',
            'offline-line',
            'offline-point',
          ];
          map.on('click', (event) => {
            const hit = map.queryRenderedFeatures(event.point, {
              layers: selectableLayers,
            })[0];
            if (!hit || hit.id === undefined || !hit.source) return;
            if (selectedRef.current) {
              map.setFeatureState(
                {
                  source: selectedRef.current.source,
                  id: selectedRef.current.id,
                },
                { selected: false }
              );
            }
            const next: SelectedFeature = {
              source: hit.source,
              id: hit.id,
              properties: hit.properties ?? {},
            };
            map.setFeatureState(
              { source: next.source, id: next.id },
              { selected: true }
            );
            selectedRef.current = next;
            setSelected(next);
          });
          for (const layer of selectableLayers) {
            map.on('mouseenter', layer, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layer, () => {
              map.getCanvas().style.cursor = '';
            });
          }
          setMapReady(true);
        });
        mapRef.current = map;
      } catch {
        setError('No se pudo iniciar el visor de mapas.');
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      detachResize?.();
      mapRef.current?.remove();
      mapRef.current = null;
      geolocateRef.current = null;
    };
    // Sources are updated independently after initialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    selectedRef.current = null;
    setSelected(null);
    for (const entry of SOURCE_DATA) {
      const source = map.getSource(entry.source) as
        | import('maplibre-gl').GeoJSONSource
        | undefined;
      source?.setData(buckets[entry.dataKey] as never);
    }
  }, [buckets, mapReady]);

  const fitFeatures = () => {
    const map = mapRef.current;
    if (!map || !bbox) return;
    const [west, south, east, north] = bbox;
    if (west === east && south === north) {
      map.easeTo({ center: [west, south], zoom: 15, duration: 500 });
    } else {
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 48, maxZoom: 16, duration: 500 }
      );
    }
  };

  useEffect(() => {
    if (!mapReady || !bbox) return;
    const timer = window.setTimeout(fitFeatures, 50);
    return () => window.clearTimeout(timer);
    // Fit once whenever the downloaded geometry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, bbox]);

  const clearSelection = () => {
    const map = mapRef.current;
    if (map && selectedRef.current) {
      map.setFeatureState(
        { source: selectedRef.current.source, id: selectedRef.current.id },
        { selected: false }
      );
    }
    selectedRef.current = null;
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{mapName}</h2>
          <p className="text-sm text-muted-foreground">
            {features.length.toLocaleString('es-MX')} elementos · geometría offline
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={fitFeatures}>
            Ajustar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => geolocateRef.current?.trigger()}
          >
            <LocateFixed className="h-4 w-4" />
            Mi ubicación
          </Button>
        </div>
      </div>

      <div className="relative h-[55vh] min-h-80 overflow-hidden rounded-xl border bg-slate-100">
        <div ref={containerRef} className="absolute inset-0" aria-label={mapName} />
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-background/90 p-6 text-center text-sm text-destructive">
            {error}
          </div>
        )}
        {features.length === 0 && !error && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
            <p className="rounded-lg border bg-background/90 p-4 text-sm text-muted-foreground shadow-sm">
              Este mapa no contiene geometrías.
            </p>
          </div>
        )}
      </div>

      {selected && (
        <div className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
          <div className="min-w-0">
            <p className="font-medium">
              {String(
                selected.properties.name ??
                  selected.properties.title ??
                  `Elemento ${selected.properties.featureId ?? selected.id}`
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Capa: {String(selected.properties.layerName ?? 'Sin nombre')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clearSelection}
            aria-label="Cerrar selección"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
