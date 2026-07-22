import { useRef, useState } from 'react';
import { Camera, ScanLine, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { recognizeIne } from '@/lib/services/ine-ocr.service';
import { saveFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import { compressInePhoto } from '@/lib/services/image-compression.service';
import { QuestionRendererProps } from './question-renderer';

function getIneSide(questionType: string | undefined): 'front' | 'back' {
  const rawType = (questionType || '').trim().toLowerCase();
  return rawType === 'ine_back' ? 'back' : 'front';
}

export function IneQuestion({
  question,
  error,
}: Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>) {
  const { files, setFiles, removeFile, responseId } = useSurveyFillStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [ocrFields, setOcrFields] = useState<Record<string, string> | null>(null);

  const questionKey = question.question_key || question.id.toString();
  const ineFiles = files[questionKey] || [];
  const side = getIneSide(question.question_type);
  const sideLabel = side === 'front' ? 'frente' : 'reverso';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    setOcrStatus('Procesando OCR...');
    setOcrWarning(null);

    try {
      const compressedFile = await compressInePhoto(file);
      const ocrResult = await recognizeIne(compressedFile, side);

      setOcrStatus(
        `OCR completado (${Math.round(ocrResult.confidence * 100)}% confianza)`
      );

      if (ocrResult.lowConfidence) {
        setOcrWarning(
          'La lectura no fue muy clara. Verifica los datos antes de enviar.'
        );
      }

      if (ocrResult.validationWarnings.length > 0) {
        setOcrWarning(
          ocrResult.validationWarnings.slice(0, 3).join('. ') + '.'
        );
      }

      setOcrFields(ocrResult.data);

      // Replace any existing file for this INE side.
      ineFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });

      const fileId = generateLocalId();
      await saveFileBlob(fileId, responseId || 'draft', compressedFile);

      setFiles(questionKey, [
        {
          id: fileId,
          fileId,
          file: compressedFile,
          previewUrl: URL.createObjectURL(compressedFile),
          fileType: question.question_type,
          questionId: questionKey,
          // Store OCR metadata so the sync engine can send it to the backend.
          ineOcrData: JSON.stringify({
            ocr_confidence: ocrResult.confidence,
            ocr_text: ocrResult.text,
            ine_modelo: ocrResult.data.ine_modelo || '',
            ine_ocr_data: ocrResult.data,
          }),
        },
      ]);
    } catch (err) {
      console.error('INE OCR failed:', err);
      setOcrStatus('OCR falló');
      setOcrWarning('No se pudo leer el INE. Puedes continuar y verificar manualmente.');
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    ineFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    if (ineFiles[0]) {
      if (ineFiles[0].fileId) {
        await deleteFileBlob(ineFiles[0].fileId);
      }
      removeFile(questionKey, ineFiles[0].id);
    }
    setOcrStatus(null);
    setOcrWarning(null);
    setOcrFields(null);
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

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id={`ine-${question.id}`}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full h-14 flex-col gap-1"
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-5 w-5" />
        <span className="text-xs">Fotografiar {sideLabel} del INE</span>
      </Button>

      {ineFiles.length > 0 && (
        <div className="relative rounded-lg border border-input overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ineFiles[0].previewUrl}
            alt={`INE ${sideLabel}`}
            className="w-full h-48 object-contain"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-background/90 rounded-full shadow-sm text-sm"
          >
            Cambiar
          </button>
        </div>
      )}

      {ocrStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          {ocrStatus}
        </div>
      )}

      {ocrWarning && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {ocrWarning}
        </div>
      )}

      {ocrFields && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1.5 text-sm">
          {Object.entries(ocrFields)
            .filter(([key, value]) => value && key !== 'raw_text' && key !== 'normalized_text' && key !== 'side')
            .slice(0, 6)
            .map(([key, value]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-medium text-right max-w-[60%] break-words">{value}</span>
              </div>
            ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
