'use client';

import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { FieldSessionSample } from '@/lib/db/database';
import { createBasemapStyle, resizeMapWhenReady } from '@/lib/maps/basemap-style';

interface RecorridoMapProps {
  samples: FieldSessionSample[];
  responses?: Array<{
    responseId: string;
    latitude: number;
    longitude: number;
    status: string;
  }>;
  className?: string;
}

type Coord = [number, number];

function boundsFor(coords: Coord[]): [Coord, Coord] | null {
  if (coords.length === 0) return null;
  let minLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLng = minLng;
  let maxLat = minLat;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function RecorridoMap({
  samples,
  responses = [],
  className,
}: RecorridoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const positioned = samples
      .filter(
        (sample) =>
          sample.sample_type === 'gps' &&
          sample.latitude != null &&
          sample.longitude != null
      )
      .sort((a, b) => a.sample_seq - b.sample_seq);
    if (positioned.length === 0) return;

    let cancelled = false;
    let map: import('maplibre-gl').Map | null = null;
    let detachResize: (() => void) | undefined;

    void (async () => {
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;

      const coords = positioned.map(
        (sample) => [sample.longitude!, sample.latitude!] as Coord
      );
      const segments: Coord[][] = [];
      let currentSegment: Coord[] = [];
      for (const sample of [...samples].sort(
        (a, b) => a.sample_seq - b.sample_seq
      )) {
        if (sample.sample_type === 'gap') {
          if (currentSegment.length >= 2) segments.push(currentSegment);
          currentSegment = [];
          continue;
        }
        if (sample.latitude != null && sample.longitude != null) {
          currentSegment.push([sample.longitude, sample.latitude]);
        }
      }
      if (currentSegment.length >= 2) segments.push(currentSegment);
      const bounds = boundsFor(coords);
      map = new maplibregl.Map({
        container: containerRef.current,
        style: createBasemapStyle(),
        center: coords[0],
        zoom: 15,
      });
      detachResize = resizeMapWhenReady(map);
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right'
      );

      map.on('load', () => {
        if (!map) return;
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: segments.map((segment) => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: segment },
            })),
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#2563eb',
            'line-width': 4,
            'line-opacity': 0.9,
          },
        });
        map.addSource('route-points', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: positioned.map((sample) => ({
              type: 'Feature',
              properties: {
                seq: sample.sample_seq,
                status: sample.upload_status,
                accuracy: sample.accuracy_m ?? null,
              },
              geometry: {
                type: 'Point',
                coordinates: [sample.longitude!, sample.latitude!],
              },
            })),
          },
        });
        map.addLayer({
          id: 'route-points',
          type: 'circle',
          source: 'route-points',
          paint: {
            'circle-radius': 4,
            'circle-color': [
              'case',
              ['==', ['get', 'status'], 'pending'],
              '#f59e0b',
              '#2563eb',
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1,
          },
        });
        if (responses.length > 0) {
          map.addSource('route-responses', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: responses.map((response) => ({
                type: 'Feature',
                properties: {
                  response_id: response.responseId,
                  status: response.status,
                },
                geometry: {
                  type: 'Point',
                  coordinates: [response.longitude, response.latitude],
                },
              })),
            },
          });
          map.addLayer({
            id: 'route-responses',
            type: 'circle',
            source: 'route-responses',
            paint: {
              'circle-radius': 7,
              'circle-color': '#7c3aed',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
        }
        if (bounds) {
          map.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
        }
      });
    })();

    return () => {
      cancelled = true;
      detachResize?.();
      map?.remove();
    };
  }, [responses, samples]);

  const hasPoints = samples.some(
    (sample) => sample.latitude != null && sample.longitude != null
  );

  return (
    <div className={className}>
      {hasPoints ? (
        <div ref={containerRef} className="h-full min-h-64 w-full rounded-lg" />
      ) : (
        <div className="flex min-h-64 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          Aún no hay puntos GPS para mostrar.
        </div>
      )}
    </div>
  );
}
