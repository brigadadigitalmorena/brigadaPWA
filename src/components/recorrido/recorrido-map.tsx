'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Button } from '@/components/ui/button';
import type { FieldSessionSample } from '@/lib/db/database';
import { createBasemapStyle, resizeMapWhenReady } from '@/lib/maps/basemap-style';
import { cn } from '@/lib/utils';

interface RecorridoMapProps {
  samples: FieldSessionSample[];
  responses?: Array<{
    responseId: string;
    latitude: number;
    longitude: number;
    status: string;
  }>;
  className?: string;
  title?: string;
  subtitle?: string;
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
  title = 'Ruta del recorrido',
  subtitle,
}: RecorridoMapProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);

  const resizeMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    window.requestAnimationFrame(() => {
      map.resize();
    });
  }, []);

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
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: createBasemapStyle(),
        center: coords[0],
        zoom: 15,
      });
      mapRef.current = map;
      detachResize = resizeMapWhenReady(map);
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-right'
      );

      map.on('load', () => {
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
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [responses, samples]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === shellRef.current;
      setNativeFullscreen(active);
      if (!active) setIsExpanded(false);
      resizeMap();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [resizeMap]);

  useEffect(() => {
    if (!isExpanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isExpanded]);

  const exitExpanded = async () => {
    if (document.fullscreenElement && shellRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // CSS overlay still closes.
      }
    }
    setIsExpanded(false);
    setNativeFullscreen(false);
    resizeMap();
  };

  const enterExpanded = async () => {
    setIsExpanded(true);
    const el = shellRef.current;
    if (el && typeof el.requestFullscreen === 'function') {
      try {
        await el.requestFullscreen();
        setNativeFullscreen(true);
      } catch {
        setNativeFullscreen(false);
      }
    }
    resizeMap();
  };

  const toggleExpanded = () => {
    if (isExpanded || nativeFullscreen) {
      void exitExpanded();
      return;
    }
    void enterExpanded();
  };

  const expanded = isExpanded || nativeFullscreen;
  const hasPoints = samples.some(
    (sample) => sample.latitude != null && sample.longitude != null
  );

  return (
    <div
      ref={shellRef}
      className={cn(
        'flex min-h-0 flex-col gap-2 bg-background',
        expanded &&
          'fixed inset-0 z-50 gap-3 p-3 sm:p-4 safe-area-top safe-area-bottom',
        !expanded && className
      )}
    >
      {expanded ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={toggleExpanded}
            aria-pressed
            aria-label="Salir de pantalla completa"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      ) : null}
      {hasPoints ? (
        <div
          className={cn(
            'relative min-h-0 overflow-hidden rounded-xl border bg-slate-100',
            expanded ? 'flex-1 min-h-[50dvh]' : 'h-full min-h-64'
          )}
        >
          <div ref={containerRef} className="absolute inset-0" />
          {!expanded ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute left-2 top-2 z-10 shadow-sm"
              onClick={toggleExpanded}
              aria-pressed={false}
              aria-label="Pantalla completa"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Pantalla completa</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="relative flex min-h-64 flex-1 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
          Aún no hay puntos GPS para mostrar.
          {!expanded ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute left-2 top-2 z-10 shadow-sm"
              onClick={toggleExpanded}
              aria-label="Pantalla completa"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
