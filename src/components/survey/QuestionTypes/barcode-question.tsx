'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';

export function BarcodeQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const [scanError, setScanError] = useState<string | null>(null);
  const isHidden = normalizeQuestionType(question.question_type) === 'barcode_hidden';

  const handleScan = async () => {
    setScanError(null);

    if (!('BarcodeDetector' in window)) {
      setScanError('Escaneo no disponible en este navegador. Ingresa el código manualmente.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const detector = new (window as Window & {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });

      const codes = await detector.detect(video);
      stream.getTracks().forEach((track) => track.stop());

      if (codes[0]?.rawValue) {
        onChange(codes[0].rawValue);
      } else {
        setScanError('No se detectó ningún código. Intenta de nuevo o escríbelo.');
      }
    } catch {
      setScanError('No se pudo acceder a la cámara. Ingresa el código manualmente.');
    }
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

      <div className="flex gap-2">
        <Input
          type={isHidden ? 'password' : 'text'}
          inputSize="mobile"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Código escaneado o manual"
          disabled={disabled}
          aria-invalid={!!error}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="mobile"
          onClick={handleScan}
          disabled={disabled}
          aria-label="Escanear código"
        >
          <ScanBarcode className="h-5 w-5" />
        </Button>
      </div>

      {scanError && <p className="text-sm text-amber-600 dark:text-amber-400">{scanError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
