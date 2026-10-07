'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const COLORS = ['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#ffffff'];

interface PhotoAnnotationProps {
  imageUrl: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function PhotoAnnotation({
  imageUrl,
  onSave,
  onCancel,
}: PhotoAnnotationProps) {
  const imageRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const imageCanvas = imageRef.current;
    const drawCanvas = drawRef.current;
    if (!imageCanvas || !drawCanvas) return;
    const image = new Image();
    image.onload = () => {
      const width = imageCanvas.parentElement?.clientWidth ?? 640;
      const height = Math.min(480, Math.round((image.height / image.width) * width));
      for (const canvas of [imageCanvas, drawCanvas]) {
        canvas.width = width;
        canvas.height = height;
      }
      imageCanvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
    };
    image.src = imageUrl;
  }, [imageUrl]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const paint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const ctx = drawRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(event);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  const save = () => {
    const imageCanvas = imageRef.current;
    const drawCanvas = drawRef.current;
    if (!imageCanvas || !drawCanvas) return;
    const output = document.createElement('canvas');
    output.width = imageCanvas.width;
    output.height = imageCanvas.height;
    const ctx = output.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imageCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);
    output.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Color ${swatch}`}
            className="h-8 w-8 rounded-full border-2"
            style={{
              backgroundColor: swatch,
              borderColor: color === swatch ? 'var(--primary)' : 'transparent',
            }}
            onClick={() => setColor(swatch)}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const canvas = drawRef.current;
            canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
          }}
        >
          Limpiar
        </Button>
      </div>
      <div className="relative mx-auto w-full max-w-3xl flex-1">
        <canvas ref={imageRef} className="absolute inset-0" />
        <canvas
          ref={drawRef}
          className="absolute inset-0 touch-none"
          onPointerDown={(event) => {
            setDrawing(true);
            paint(event);
          }}
          onPointerMove={paint}
          onPointerUp={() => setDrawing(false)}
          onPointerLeave={() => setDrawing(false)}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={save}>
          Guardar anotación
        </Button>
      </div>
    </div>
  );
}
