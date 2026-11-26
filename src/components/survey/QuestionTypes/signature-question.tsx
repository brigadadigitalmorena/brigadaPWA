import { useRef, useEffect, useCallback, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser, Maximize2, Minimize2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { saveFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import {
  signatureStrokeLimits,
  strokeCountAllowed,
} from '@/lib/forms/field-rules';
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
  const { min: minStrokes, max: maxStrokes } = signatureStrokeLimits(
    question.validation_rules
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [strokeError, setStrokeError] = useState<string | null>(null);

  const saveSignature = useCallback(() => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    const strokeErrorMessage = strokeCountAllowed(pad.toData().length, {
      min: minStrokes,
      max: maxStrokes,
    });
    if (strokeErrorMessage) {
      setStrokeError(strokeErrorMessage);
      return;
    }
    setStrokeError(null);

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
            questionId: question.id.toString(),
          },
        ]);
      });
  }, [maxStrokes, minStrokes, question.id, questionKey, responseId, setFiles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Setting canvas width clears the bitmap. Keep the strokes and paint
      // the white sheet again; otherwise the dark card shows through.
      const previousPad = padRef.current;
      const previousData = previousPad?.isEmpty() ? undefined : previousPad?.toData();

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
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

      if (previousData && previousData.length > 0 && padRef.current) {
        padRef.current.fromData(previousData);
      } else {
        padRef.current?.clear();
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

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [fullscreen]);

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

      <div
        className={
          fullscreen
            ? 'fixed inset-0 z-50 flex flex-col bg-background px-4 pt-4'
            : 'space-y-3'
        }
        style={
          fullscreen
            ? { paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }
            : undefined
        }
      >
        <div className={fullscreen ? 'min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-300 bg-white touch-none' : 'overflow-hidden rounded-xl border border-neutral-300 bg-white touch-none'}>
          <canvas
            ref={canvasRef}
            className={fullscreen ? 'block h-full w-full cursor-crosshair bg-white' : 'block h-40 w-full cursor-crosshair bg-white'}
            aria-label="Área para firmar"
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="mobile"
            onClick={clearSignature}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="mobile"
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {fullscreen ? 'Cerrar' : 'Pantalla completa'}
          </Button>
          {hasSignature && (
            <span className="text-sm text-muted-foreground">Firma capturada</span>
          )}
        </div>

        {strokeError && <p className="shrink-0 text-sm text-amber-600 dark:text-amber-400">{strokeError}</p>}
        {error && <p className="shrink-0 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
