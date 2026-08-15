'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import { staticMapsRepository } from '@/lib/services/static-maps.repository';
import {
  emptyFeatureCollection,
  featureCollectionFromRows,
  splitByGeometry,
} from '@/lib/maps/geojson';
import { createBasemapStyle, resizeMapWhenReady } from '@/lib/maps/basemap-style';

type GisPoint = { lat: number; lng: number };

function answerGeoJson(
  points: GisPoint[],
  type: string
): GeoJSON.FeatureCollection {
  const coordinates = points.map((point) => [point.lng, point.lat]);
  const features: GeoJSON.Feature[] = points.map((point, index) => ({
    type: 'Feature',
    properties: { index },
    geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
  }));

  if (coordinates.length >= 2 && type !== 'gis_point') {
    if (type === 'gis_polygon' && coordinates.length >= 3) {
      features.unshift({
        type: 'Feature',
        properties: { shape: 'polygon' },
        geometry: {
          type: 'Polygon',
          coordinates: [[...coordinates, coordinates[0]]],
        },
      });
    } else {
      features.unshift({
        type: 'Feature',
        properties: { shape: 'line' },
        geometry: { type: 'LineString', coordinates },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

export function GisQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const points = useMemo<Array<{ lat: number; lng: number }>>(
    () =>
      Array.isArray(value)
        ? (value as Array<{ lat: number; lng: number }>)
        : value && typeof value === 'object' && 'lat' in (value as object)
          ? [value as { lat: number; lng: number }]
          : [],
    [value]
  );

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onChangeRef = useRef(onChange);
  const pointsRef = useRef(points);
  const [mapError, setMapError] = useState<string | null>(null);

  const normalizedType = normalizeQuestionType(question.question_type);
  const isMultiPoint =
    normalizedType === 'gis_line' ||
    normalizedType === 'gis_polygon' ||
    normalizedType === 'gis_tracking_manual' ||
    normalizedType === 'gis_tracking_auto';
  const operationalRows = useLiveQuery(async () => {
    const map = await staticMapsRepository.getFirstMap();
    return map ? staticMapsRepository.getFeatures(map.map_id) : [];
  }, []);
  const operationalGeometry = useMemo(
    () => splitByGeometry(featureCollectionFromRows(operationalRows ?? [])),
    [operationalRows]
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    let cancelled = false;
    let detachResize: (() => void) | undefined;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const maplibregl = await import('maplibre-gl');

        if (cancelled || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: createBasemapStyle(),
          center: [-99.1332, 19.4326],
          zoom: 12,
        });
        detachResize = resizeMapWhenReady(map);
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          'top-right'
        );

        map.on('load', () => {
          map.addSource('operational-polygons', {
            type: 'geojson',
            data: emptyFeatureCollection(),
          });
          map.addLayer({
            id: 'operational-fill',
            type: 'fill',
            source: 'operational-polygons',
            paint: {
              'fill-color': '#16a34a',
              'fill-opacity': 0.12,
            },
          });
          map.addLayer({
            id: 'operational-outline',
            type: 'line',
            source: 'operational-polygons',
            paint: {
              'line-color': '#15803d',
              'line-width': 1.5,
            },
          });
          map.addSource('operational-lines', {
            type: 'geojson',
            data: emptyFeatureCollection(),
          });
          map.addLayer({
            id: 'operational-lines',
            type: 'line',
            source: 'operational-lines',
            paint: {
              'line-color': '#15803d',
              'line-width': 2,
            },
          });
          map.addSource('answer-geometry', {
            type: 'geojson',
            data: answerGeoJson(pointsRef.current, normalizedType),
          });
          map.addLayer({
            id: 'answer-fill',
            type: 'fill',
            source: 'answer-geometry',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': '#2563eb',
              'fill-opacity': 0.2,
            },
          });
          map.addLayer({
            id: 'answer-line',
            type: 'line',
            source: 'answer-geometry',
            filter: [
              'in',
              ['geometry-type'],
              ['literal', ['LineString', 'Polygon']],
            ],
            paint: {
              'line-color': '#2563eb',
              'line-width': 3,
            },
          });
          map.addLayer({
            id: 'answer-points',
            type: 'circle',
            source: 'answer-geometry',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-color': '#2563eb',
              'circle-radius': 6,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
        });

        map.on('click', (event) => {
          if (disabled) return;
          const nextPoint = { lat: event.lngLat.lat, lng: event.lngLat.lng };
          onChangeRef.current(
            isMultiPoint
              ? [...pointsRef.current, nextPoint]
              : nextPoint
          );
        });

        mapRef.current = map;
      } catch {
        setMapError('No se pudo cargar el mapa. Usa el botón para capturar tu ubicación.');
      }
    };

    initMap();

    return () => {
      cancelled = true;
      detachResize?.();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [disabled, isMultiPoint, normalizedType]);

  useEffect(() => {
    pointsRef.current = points;
    const source = mapRef.current?.getSource(
      'answer-geometry'
    ) as GeoJSONSource | undefined;
    source?.setData(answerGeoJson(points, normalizedType));
  }, [points, normalizedType]);

  useEffect(() => {
    const polygons = mapRef.current?.getSource(
      'operational-polygons'
    ) as GeoJSONSource | undefined;
    const lines = mapRef.current?.getSource(
      'operational-lines'
    ) as GeoJSONSource | undefined;
    polygons?.setData(operationalGeometry.polygons);
    lines?.setData(operationalGeometry.lines);
  }, [operationalGeometry]);

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError('Geolocalización no disponible');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        onChange(isMultiPoint ? [...points, point] : point);
      },
      () => setMapError('No se pudo obtener la ubicación actual')
    );
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      <div
        ref={mapContainerRef}
        className="h-56 w-full overflow-hidden rounded-xl border border-border"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="mobile"
          onClick={captureCurrentLocation}
          disabled={disabled}
        >
          <MapPin className="h-4 w-4" />
          Usar mi ubicación
        </Button>
        {points.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="mobile"
            onClick={() => onChange(isMultiPoint ? [] : null)}
            disabled={disabled}
          >
            Limpiar puntos ({points.length})
          </Button>
        )}
      </div>

      {mapError && <p className="text-sm text-amber-600 dark:text-amber-400">{mapError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
