import { useState } from 'react';
import { MapPin, LocateFixed } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ruleNumber } from '@/lib/forms/field-rules';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { QuestionRendererProps } from './question-renderer';

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
}

function readCaptured(value: unknown): CapturedLocation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude ?? record.lat);
  const longitude = Number(record.longitude ?? record.lng ?? record.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const accuracy = Number(record.accuracy);
  const altitude = Number(record.altitude);
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    altitude: Number.isFinite(altitude) ? altitude : null,
  };
}

export function LocationQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const setResponseLocation = useSurveyFillStore((state) => state.setLocation);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const captured = readCaptured(value);
  const maxAccuracy =
    ruleNumber(question.validation_rules, 'max_accuracy_m') ??
    ruleNumber(question.validation_rules, 'accuracy_threshold_m');
  const requireAltitude = question.validation_rules?.require_altitude === true;

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setCaptureError('La geolocalización no está disponible en este dispositivo');
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        const altitude = position.coords.altitude;
        if (maxAccuracy != null && accuracy > maxAccuracy) {
          setIsCapturing(false);
          setCaptureError(
            `La precisión GPS debe ser menor o igual a ${Math.floor(maxAccuracy)} m`
          );
          return;
        }
        if (requireAltitude && altitude == null) {
          setIsCapturing(false);
          setCaptureError('Esta ubicación requiere altitud GPS');
          return;
        }

        const answer = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
          altitude,
          timestamp: position.timestamp,
        };
        onChange(answer);
        setResponseLocation({
          latitude: answer.latitude,
          longitude: answer.longitude,
          accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        });
        setIsCapturing(false);
      },
      (err) => {
        setIsCapturing(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setCaptureError('Permiso de ubicación denegado');
            break;
          case err.POSITION_UNAVAILABLE:
            setCaptureError('Ubicación no disponible');
            break;
          case err.TIMEOUT:
            setCaptureError('Tiempo de espera agotado al obtener ubicación');
            break;
          default:
            setCaptureError('Error al obtener la ubicación');
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
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

      <Button
        type="button"
        variant="outline"
        className="w-full h-14 flex-col gap-1"
        onClick={captureLocation}
        disabled={disabled || isCapturing}
      >
        {isCapturing ? (
          <LocateFixed className="h-5 w-5 animate-spin" />
        ) : (
          <MapPin className="h-5 w-5" />
        )}
        <span className="text-xs">
          {isCapturing ? 'Capturando...' : 'Capturar ubicación GPS'}
        </span>
      </Button>

      {captured && (
        <div className="rounded-lg border border-input bg-muted/50 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Latitud</span>
            <span className="font-mono">{captured.latitude.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Longitud</span>
            <span className="font-mono">{captured.longitude.toFixed(6)}</span>
          </div>
          {captured.accuracy != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precisión</span>
              <span className="font-mono">±{Math.round(captured.accuracy)} m</span>
            </div>
          )}
        </div>
      )}

      {captureError && <p className="text-sm text-destructive">{captureError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
