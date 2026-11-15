'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { compressPhoto } from '@/lib/services/image-compression.service';
import {
  REPORT_MAX_ATTACHMENTS,
  SUPPORT_EMAIL,
  buildReportBody,
  canShareFiles,
  downloadAttachment,
  openMailtoReport,
  shareBugReport,
  validateReportImage,
  type ReportAttachment,
} from '@/lib/services/report-issue.service';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function newAttachmentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReportPage() {
  const { user } = useAuth();
  const galleryInputId = useId();
  const cameraInputId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ReportAttachment[]>([]);

  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      for (const item of attachmentsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const revokeAndRemove = (id: string) => {
    setAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const clearAttachments = () => {
    setAttachments((current) => {
      for (const item of current) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const remaining = REPORT_MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${REPORT_MAX_ATTACHMENTS} capturas por reporte.`);
      return;
    }

    const incoming = Array.from(fileList).slice(0, remaining);
    setIsAdding(true);
    try {
      const next: ReportAttachment[] = [];
      for (const original of incoming) {
        const validationError = validateReportImage(original);
        if (validationError) {
          toast.error(validationError);
          continue;
        }
        const compressed = await compressPhoto(original);
        next.push({
          id: newAttachmentId(),
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
      }
      if (next.length === 0) return;
      setAttachments((current) => [...current, ...next].slice(0, REPORT_MAX_ATTACHMENTS));
      toast.success(
        next.length === 1
          ? 'Captura agregada'
          : `${next.length} capturas agregadas`
      );
    } catch {
      toast.error('No se pudieron procesar las imágenes.');
    } finally {
      setIsAdding(false);
      if (galleryRef.current) galleryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const send = async () => {
    const text = description.trim();
    if (!text) {
      toast.error('Describe el problema antes de enviarlo.');
      return;
    }

    setIsSending(true);
    const subject = 'Reporte de problema - Brigada Digital PWA';
    const files = attachments.map((item) => item.file);
    const body = buildReportBody({
      description: text,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'pwa',
      route:
        typeof window !== 'undefined' ? window.location.pathname : '/report',
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : '',
      attachmentNames: files.map((file) => file.name),
    });
    const contextLines = [
      user ? `Usuario: ${user.nombre} ${user.apellido} <${user.email}>` : null,
      user?.id ? `User ID: ${user.id}` : null,
    ].filter(Boolean);
    const fullBody =
      contextLines.length > 0
        ? `${body}\n\n${contextLines.join('\n')}`
        : body;

    try {
      if (files.length > 0 && canShareFiles(files)) {
        const result = await shareBugReport({
          subject,
          body: fullBody,
          files,
        });
        if (result === 'shared') {
          toast.success('Elige tu correo y envía el reporte con las capturas.');
          setDescription('');
          clearAttachments();
          return;
        }
        if (result === 'aborted') return;
      }

      if (files.length > 0) {
        for (const file of files) {
          downloadAttachment(file);
        }
        toast.message(
          'Se descargaron las capturas. Adjúntalas en el correo que se abrirá.',
          { duration: 6_000 }
        );
        // Give the downloads a beat before navigating away to mailto.
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      openMailtoReport(subject, fullBody);
      toast.success(
        files.length > 0
          ? 'Correo abierto. Verifica que las capturas estén adjuntas antes de enviar.'
          : 'Correo abierto con el reporte.'
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo preparar el reporte.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const slotsLeft = REPORT_MAX_ATTACHMENTS - attachments.length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader
        title="Reportar un error"
        description="Describe el problema y adjunta capturas para soporte"
        backHref="/home"
        backLabel="Inicio"
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
            Incluye pasos para reproducir el error y capturas claras. El reporte
            se envía por correo a{' '}
            <span className="font-medium text-foreground">{SUPPORT_EMAIL}</span>.
          </p>

          <div className="space-y-2">
            <Label htmlFor="report">Qué pasó</Label>
            <Textarea
              id="report"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              placeholder="Qué estabas haciendo, qué viste y cómo reproducirlo"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Capturas / fotos</Label>
              <span className="text-xs text-muted-foreground">
                {attachments.length}/{REPORT_MAX_ATTACHMENTS}
              </span>
            </div>

            <input
              ref={galleryRef}
              id={galleryInputId}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => void addFiles(event.target.files)}
            />
            <input
              ref={cameraRef}
              id={cameraInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => void addFiles(event.target.files)}
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
                      onClick={() => revokeAndRemove(item.id)}
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
                  onClick={clearAttachments}
                >
                  <Trash2 className="h-4 w-4" />
                  Quitar todas
                </Button>
              ) : null}
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>• Describe el flujo exacto donde falla.</li>
            <li>• Agrega contexto (encuesta, módulo, dispositivo).</li>
            <li>• Verifica que las capturas se lean bien.</li>
          </ul>

          <Button
            type="button"
            size="mobile"
            className="w-full"
            onClick={() => void send()}
            disabled={isSending || isAdding}
          >
            {isSending || isAdding ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {isAdding ? 'Procesando imágenes…' : 'Preparando reporte…'}
              </>
            ) : (
              'Enviar reporte'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
