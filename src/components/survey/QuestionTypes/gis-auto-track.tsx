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
  /** Auto mode keeps every sample. Manual callers can pass a positive filter. */
  minDistanceM?: number;
  maxDurationS?: number;
  onChange: (value: GisTrack) => void;
}

export function GisAutoTrack({
  value,
  disabled,
  intervalMs,
  minDistanceM = 0,
  maxDurationS,
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
    if (!navigator.geolocation) {
      setMessage('Geolocalización no disponible');
      setTracking(false);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    const sample = () => {
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          const current = readTrack(valueRef.current);
          const next = appendTrackSample(
            current,
            [position.coords.longitude, position.coords.latitude],
            new Date(position.timestamp).toISOString(),
            minDistanceM
          );
          if (next.coordinates.length !== current.coordinates.length) {
            valueRef.current = next;
            onChangeRef.current(next);
          }
        },
        () => {
          if (!cancelled) setMessage('No se pudo leer el GPS. Reintentando…');
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
      );
    };

    sample();
    const intervalId = window.setInterval(() => {
      if (
        maxDurationS != null &&
        (Date.now() - startedAt) / 1000 >= maxDurationS
      ) {
        setMessage(`Duración máxima alcanzada (${maxDurationS} s).`);
        setTracking(false);
        return;
      }
      sample();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [intervalMs, maxDurationS, minDistanceM, tracking]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={tracking ? 'destructive' : 'outline'}
        size="mobile"
        disabled={disabled}
        onClick={() => {
          setMessage(null);
          setTracking((current) => !current);
        }}
      >
        {tracking ? 'Detener recorrido automático' : 'Iniciar recorrido automático'}
      </Button>
      {message && <p className="text-sm text-amber-600 dark:text-amber-400">{message}</p>}
    </div>
  );
}
