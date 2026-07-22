'use client';

import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';

export function GisQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const points: Array<{ lat: number; lng: number }> = Array.isArray(value)
    ? (value as Array<{ lat: number; lng: number }>)
    : value && typeof value === 'object' && 'lat' in (value as object)
      ? [value as { lat: number; lng: number }]
      : [];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const onChangeRef = useRef(onChange);
  const pointsRef = useRef(points);
  const [mapError, setMapError] = useState<string | null>(null);

  const normalizedType = normalizeQuestionType(question.question_type);
  const isMultiPoint =
    normalizedType === 'gis_line' ||
    normalizedType === 'gis_polygon' ||
    normalizedType === 'gis_tracking_manual' ||
    normalizedType === 'gis_tracking_auto';

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const maplibregl = await import('maplibre-gl');
        await import('maplibre-gl/dist/maplibre-gl.css');

        if (cancelled || !mapContainerRef.current) return;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: 'https://demotiles.maplibre.org/style.json',
          center: [-99.1332, 19.4326],
          zoom: 12,
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
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [disabled, isMultiPoint]);

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
