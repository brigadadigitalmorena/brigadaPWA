'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createBasemapStyle, resizeMapWhenReady } from '@/lib/maps/basemap-style';
import {
  responsePointsToGeoJson,
  type ResponseMapPoint,
} from '@/lib/maps/response-points';

interface SubmissionMapProps {
  points: ResponseMapPoint[];
  onSelect: (point: ResponseMapPoint) => void;
}

export function SubmissionMap({ points, onSelect }: SubmissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let detachResize: (() => void) | undefined;

    const init = async () => {
      if (!containerRef.current) return;
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: createBasemapStyle(),
        center: [-99.1332, 19.4326],
        zoom: 11,
      });
      detachResize = resizeMapWhenReady(map);
      map.on('load', () => {
        map.addSource('responses', {
          type: 'geojson',
          data: responsePointsToGeoJson(points),
          cluster: true,
          clusterRadius: 48,
        });
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'responses',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#2563eb',
            'circle-radius': 18,
          },
        });
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'responses',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 12,
          },
          paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
          id: 'response-points',
          type: 'circle',
          source: 'responses',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 7,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        });
        map.on('click', 'response-points', (event) => {
          const feature = event.features?.[0];
          const responseId = feature?.properties?.responseId;
          const match = points.find((point) => point.responseId === responseId);
          if (match) onSelectRef.current(match);
        });
      });
      mapRef.current = map;
    };

    void init();
    return () => {
      cancelled = true;
      detachResize?.();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Map instance is created once; points update through the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource('responses') as
      | { setData: (data: GeoJSON.FeatureCollection) => void }
      | undefined;
    source?.setData(responsePointsToGeoJson(points));
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-2xl border"
    />
  );
}
