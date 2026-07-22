import { useState } from 'react';
import { MapPin, LocateFixed } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { QuestionRendererProps } from './question-renderer';

export function LocationQuestion({
  question,
  error,
}: Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>) {
  const { location, setLocation } = useSurveyFillStore();
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setCaptureError('La geolocalización no está disponible en este dispositivo');
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          captured_at: new Date().toISOString(),
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
        disabled={isCapturing}
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

      {location && (
        <div className="rounded-lg border border-input bg-muted/50 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Latitud</span>
            <span className="font-mono">{location.latitude.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Longitud</span>
            <span className="font-mono">{location.longitude.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Precisión</span>
            <span className="font-mono">±{Math.round(location.accuracy)} m</span>
          </div>
        </div>
      )}

      {captureError && (
        <p className="text-sm text-destructive">{captureError}</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
