'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import type { IssueSeverity } from '@/lib/api/issue-reports.service';
import {
  REPORT_MAX_ATTACHMENTS,
  REPORT_SEVERITY_OPTIONS,
  newClientId,
  prepareReportImage,
  submitIssueReport,
  type ReportAttachment,
} from '@/lib/services/report-issue.service';
import { ReportAttachmentsField } from '@/components/report/report-attachments-field';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function ReportPage() {
  const { user } = useAuth();
  const galleryInputId = useId();
  const cameraInputId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ReportAttachment[]>([]);
  const reportClientIdRef = useRef(newClientId());

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
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
        try {
          const prepared = await prepareReportImage(original);
          next.push({
            id: newClientId(),
            file: prepared,
            previewUrl: URL.createObjectURL(prepared),
          });
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'No se pudo procesar una imagen.'
          );
        }
      }
      if (next.length === 0) return;
      setAttachments((current) =>
        [...current, ...next].slice(0, REPORT_MAX_ATTACHMENTS)
      );
      toast.success(
        next.length === 1
          ? 'Captura agregada'
          : `${next.length} capturas agregadas`
      );
    } finally {
      setIsAdding(false);
      if (galleryRef.current) galleryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSeverity('medium');
    clearAttachments();
    reportClientIdRef.current = newClientId();
  };

  const send = async () => {
    const trimmedTitle = title.trim();
    const text = description.trim();
    if (!trimmedTitle) {
      toast.error('Escribe un título corto del problema.');
      return;
    }
    if (!text) {
      toast.error('Describe el problema antes de enviarlo.');
      return;
    }
    if (attachments.length < 1) {
      toast.error('Agrega al menos una captura de pantalla.');
      return;
    }

    setIsSending(true);
    try {
      const result = await submitIssueReport({
        clientId: reportClientIdRef.current,
        title: trimmedTitle,
        description: text,
        severity,
        files: attachments.map((item) => item.file),
        fileClientIds: attachments.map((item) => item.id),
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'pwa',
        route:
          typeof window !== 'undefined' ? window.location.pathname : '/report',
        userAgent:
          typeof navigator !== 'undefined'
            ? navigator.userAgent.slice(0, 180)
            : '',
        userId: user?.id ?? null,
      });

      if (result.status === 'duplicate') {
        toast.success('Este reporte ya estaba registrado.');
      } else {
        toast.success(
          result.id
            ? `Reporte #${result.id} enviado con las capturas.`
            : 'Reporte enviado con las capturas.'
        );
      }
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo enviar el reporte.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageHeader
        title="Reportar un error"
        description="Describe el problema y adjunta capturas para soporte"
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            Las capturas se suben de forma segura. Se requiere al menos una
            imagen (JPEG, PNG o WebP · máx. 5 MB · hasta{' '}
            {REPORT_MAX_ATTACHMENTS}).
          </p>

          <div className="space-y-2">
            <Label htmlFor="report-title">Título</Label>
            <Input
              id="report-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="Resumen corto del error"
              inputSize="mobile"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-severity">Severidad</Label>
            <select
              id="report-severity"
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as IssueSeverity)
              }
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {REPORT_SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

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

          <ReportAttachmentsField
            attachments={attachments}
            isAdding={isAdding}
            galleryInputId={galleryInputId}
            cameraInputId={cameraInputId}
            galleryRef={galleryRef}
            cameraRef={cameraRef}
            onAddFiles={(files) => void addFiles(files)}
            onRemove={revokeAndRemove}
            onClear={clearAttachments}
          />

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
                {isAdding ? 'Procesando imágenes…' : 'Enviando reporte…'}
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
