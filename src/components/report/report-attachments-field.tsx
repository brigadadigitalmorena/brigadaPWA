'use client';

import { Camera, ImagePlus, Trash2, X } from 'lucide-react';
import type { ReportAttachment } from '@/lib/services/report-issue.service';
import { REPORT_MAX_ATTACHMENTS } from '@/lib/services/report-issue.service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ReportAttachmentsFieldProps {
  attachments: ReportAttachment[];
  isAdding: boolean;
  galleryInputId: string;
  cameraInputId: string;
  galleryRef: React.RefObject<HTMLInputElement | null>;
  cameraRef: React.RefObject<HTMLInputElement | null>;
  onAddFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function ReportAttachmentsField({
  attachments,
  isAdding,
  galleryInputId,
  cameraInputId,
  galleryRef,
  cameraRef,
  onAddFiles,
  onRemove,
  onClear,
}: ReportAttachmentsFieldProps) {
  const slotsLeft = REPORT_MAX_ATTACHMENTS - attachments.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Capturas (obligatorio)</Label>
        <span className="text-xs text-muted-foreground">
          {attachments.length}/{REPORT_MAX_ATTACHMENTS}
        </span>
      </div>

      <input
        ref={galleryRef}
        id={galleryInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        multiple
        className="hidden"
        onChange={(event) => onAddFiles(event.target.files)}
      />
      <input
        ref={cameraRef}
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => onAddFiles(event.target.files)}
      />

      {attachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-xl border bg-muted/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="aspect-[4/3] h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className={cn(
                  'absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center',
                  'rounded-full bg-background/90 text-destructive shadow-sm',
                  'hover:bg-background'
                )}
                aria-label={`Quitar ${item.file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
              <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">
                {item.file.name}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={isAdding || slotsLeft <= 0}
          onClick={() => galleryRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed',
            'bg-muted/20 px-4 py-8 text-center transition-colors',
            'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          <ImagePlus className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium">
            Agregar capturas de pantalla
          </span>
          <span className="text-xs text-muted-foreground">
            JPEG, PNG o WebP · hasta 5 MB c/u
          </span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isAdding || slotsLeft <= 0}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          Galería
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isAdding || slotsLeft <= 0}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          Cámara
        </Button>
        {attachments.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={isAdding}
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" />
            Quitar todas
          </Button>
        ) : null}
      </div>
    </div>
  );
}
