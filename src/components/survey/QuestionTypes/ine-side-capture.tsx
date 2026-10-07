'use client';

import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LocalFilePreview } from '@/lib/store/survey-fill.store';

type IneSide = 'front' | 'back';

interface IneSideCaptureProps {
  side: IneSide;
  preview?: LocalFilePreview;
  disabled?: boolean;
  onCapture: (side: IneSide) => void;
  onRemove: (side: IneSide) => void;
}

export function IneSideCapture({
  side,
  preview,
  disabled,
  onCapture,
  onRemove,
}: IneSideCaptureProps) {
  const label = side === 'front' ? 'frente' : 'reverso';

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-14 w-full flex-col gap-1"
        onClick={() => onCapture(side)}
        disabled={disabled}
      >
        <Camera className="h-5 w-5" />
        <span className="text-xs">Fotografiar {label}</span>
      </Button>
      {preview && (
        <div className="relative overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.previewUrl} alt={`INE ${label}`} className="h-40 w-full object-contain" />
          <button
            type="button"
            onClick={() => onRemove(side)}
            className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs"
            disabled={disabled}
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}
