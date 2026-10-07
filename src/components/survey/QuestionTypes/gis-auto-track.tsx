'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  appendTrackSample,
  readTrack,
  type GisTrack,
} from '@/lib/forms/field-rules';

interface GisAutoTrackProps {
  value: unknown;
  disabled?: boolean;
  intervalMs: number;
  onChange: (value: GisTrack) => void;
}

export function GisAutoTrack({
  value,
  disabled,
  intervalMs,
  onChange,
}: GisAutoTrackProps) {
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [onChange, value]);

  useEffect(() => {
    if (!tracking) return;
    let watchId = 0;
    const sample = (position: GeolocationPosition) => {
      const current = readTrack(valueRef.current);
      const next = appendTrackSample(
        current,
        [position.coords.longitude, position.coords.latitude],
        new Date(position.timestamp).toISOString(),
        5
      );
      if (next.coordinates.length !== current.coordinates.length) {
        valueRef.current = next;
        onChangeRef.current(next);
      }
    };
    if (!navigator.geolocation) {
      setMessage('Geolocalización no disponible');
      setTracking(false);
      return;
    }
    watchId = navigator.geolocation.watchPosition(sample, () => {
      setMessage('No se pudo leer el GPS. Reintentando…');
    }, { enableHighAccuracy: true, maximumAge: intervalMs });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [intervalMs, tracking]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={tracking ? 'destructive' : 'outline'}
        size="mobile"
        disabled={disabled}
        onClick={() => setTracking((current) => !current)}
      >
        {tracking ? 'Detener recorrido automático' : 'Iniciar recorrido automático'}
      </Button>
      {message && <p className="text-sm text-amber-600 dark:text-amber-400">{message}</p>}
    </div>
  );
}
