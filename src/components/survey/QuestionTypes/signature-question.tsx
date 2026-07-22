import { useRef, useEffect, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { saveFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import { QuestionRendererProps } from './question-renderer';

export function SignatureQuestion({
  question,
  error,
}: Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const previousPreviewUrlRef = useRef<string | null>(null);
  const { files, setFiles, removeFile, responseId } = useSurveyFillStore();

  const questionKey = question.question_key || question.id.toString();
  const signatureFiles = files[questionKey] || [];
  const hasSignature = signatureFiles.length > 0;

  const saveSignature = useCallback(() => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;

    const dataUrl = pad.toDataURL('image/png');
    fetch(dataUrl)
      .then((res) => res.blob())
      .then(async (blob) => {
        const file = new File([blob], `signature-${Date.now()}.png`, {
          type: 'image/png',
        });

        if (previousPreviewUrlRef.current) {
          URL.revokeObjectURL(previousPreviewUrlRef.current);
        }

        const fileId = generateLocalId();
        await saveFileBlob(fileId, responseId || 'draft', file);

        const previewUrl = URL.createObjectURL(file);
        previousPreviewUrlRef.current = previewUrl;

        setFiles(questionKey, [
          {
            id: fileId,
            fileId,
            file,
            previewUrl,
            fileType: 'signature',
            questionId: questionKey,
          },
        ]);
      });
  }, [questionKey, responseId, setFiles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = parent.getBoundingClientRect();

      // Save current signature content before resizing
      const previousPad = padRef.current;
      const previousData = previousPad?.isEmpty() ? undefined : previousPad?.toData();

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(ratio, ratio);
      }

      if (!padRef.current) {
        padRef.current = new SignaturePad(canvas, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(0, 0, 0)',
          minWidth: 0.5,
          maxWidth: 2.5,
          throttle: 16,
        });

        padRef.current.addEventListener('endStroke', saveSignature);
      }

      // Restore strokes after resize
      if (previousData && padRef.current) {
        padRef.current.fromData(previousData);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      padRef.current?.off();
      padRef.current = null;
    };
  }, [saveSignature]);

  const clearSignature = async () => {
    padRef.current?.clear();
    signatureFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    previousPreviewUrlRef.current = null;
    if (signatureFiles[0]) {
      if (signatureFiles[0].fileId) {
        await deleteFileBlob(signatureFiles[0].fileId);
      }
      removeFile(questionKey, signatureFiles[0].id);
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

      <div className="rounded-xl border border-input bg-card overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-40 block cursor-crosshair"
          aria-label="Área para firmar"
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="mobile"
          onClick={clearSignature}
        >
          <Eraser className="h-4 w-4 mr-2" />
          Limpiar
        </Button>
        {hasSignature && (
          <span className="text-sm text-muted-foreground">Firma capturada</span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
