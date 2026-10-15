'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const SUPPORT_EMAIL = 'brigadadigitalmorena@gmail.com';

export default function ReportPage() {
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const send = () => {
    const text = description.trim();
    if (!text) {
      toast.error('Describe el problema antes de enviarlo.');
      return;
    }
    const body = [
      text,
      '',
      `App: ${process.env.NEXT_PUBLIC_APP_VERSION ?? 'pwa'}`,
      `Ruta: ${window.location.pathname}`,
      fileName ? `Captura seleccionada: ${fileName} (adjúntala al correo)` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Reporte Brigada PWA')}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <PageHeader
        title="Reportar un error"
        description="Se abre tu correo con el texto listo para soporte"
      />
      <div className="space-y-2">
        <Label htmlFor="report">Qué pasó</Label>
        <Textarea
          id="report"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          placeholder="Cuéntanos qué estabas haciendo y qué viste"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shot">Captura (opcional)</Label>
        <input
          id="shot"
          type="file"
          accept="image/*"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
        />
        {fileName && (
          <p className="text-xs text-muted-foreground">
            Adjunta {fileName} manualmente en el correo. El navegador no puede pegar archivos en mailto.
          </p>
        )}
      </div>
      <Button type="button" onClick={send}>
        Enviar reporte
      </Button>
    </div>
  );
}
