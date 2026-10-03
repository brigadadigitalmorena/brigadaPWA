import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ScanLine, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import type { LocalFilePreview } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { recognizeIne } from '@/lib/services/ine-ocr.service';
import type { IneOcrResult } from '@/lib/services/ine-ocr.service';
import { saveFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import { compressInePhoto } from '@/lib/services/image-compression.service';
import { buildFlatIneAnswer } from '@/lib/ocr/build-flat-ine-answer';
import { QuestionRendererProps } from './question-renderer';

type IneSide = 'front' | 'back';

/**
 * Which sides this question must capture.
 *
 * The backend contract is ONE `ine_ocr` question requiring both `front` and
 * `back` (backEnd/scripts/seed_v2_full.py). The App has a single combined
 * capture component for it. `ine_back` exists only as a renderer alias for a
 * hypothetical split-question config, so we keep single-side behavior for it.
 */
function getIneSides(questionType: string | undefined): IneSide[] {
  const rawType = (questionType || '').trim().toLowerCase();
  if (rawType === 'ine_back') return ['back'];
  if (rawType === 'ine_front') return ['front'];
  return ['front', 'back'];
}

function sideToFileType(side: IneSide): LocalFilePreview['fileType'] {
  return side === 'back' ? 'ine_back' : 'ine_front';
}

const SIDE_LABEL: Record<IneSide, string> = {
  front: 'frente',
  back: 'reverso',
};

export function IneQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const { files, setFiles, removeFile, responseId } = useSurveyFillStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingSide, setPendingSide] = useState<IneSide>('front');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [ocrFields, setOcrFields] = useState<Record<string, string> | null>(null);

  const questionKey = question.question_key || question.id.toString();
  const sides = getIneSides(question.question_type);
  const ineFiles = useMemo(() => files[questionKey] || [], [files, questionKey]);

  const fileForSide = useCallback(
    (side: IneSide) =>
      ineFiles.find((f) => f.fileType === sideToFileType(side)) ?? null,
    [ineFiles],
  );

  /**
   * Merge the captured files + their OCR into one answer and hand it upward.
   * File ids are what the sync engine persists; OCR fields are the flat
   * snake_case surface JSONLogic reads (`answers.ine.curp`).
   */
  const emitAnswer = useCallback(
    (nextFiles: LocalFilePreview[]) => {
      const front = nextFiles.find((f) => f.fileType === 'ine_front') ?? null;
      const back = nextFiles.find((f) => f.fileType === 'ine_back') ?? null;

      const parseOcr = (preview: LocalFilePreview | null): IneOcrResult | null => {
        if (!preview?.ineOcrData) return null;
        try {
          const parsed = JSON.parse(preview.ineOcrData) as {
            ine_ocr_data?: Record<string, string>;
            ocr_confidence?: number;
            ocr_text?: string;
          };
          const fields = parsed.ine_ocr_data ?? {};
          const side = preview.fileType === 'ine_back' ? 'back' : 'front';
          return {
            text: parsed.ocr_text ?? '',
            confidence: parsed.ocr_confidence ?? 0,
            data: fields,
            lowConfidence: (parsed.ocr_confidence ?? 0) < 0.6,
            side,
            validationWarnings: [],
          };
        } catch {
          return null;
        }
      };

      const frontOcr = parseOcr(front);
      const backOcr = parseOcr(back);
      // Front carries the identity fields; back wins for the fields it owns.
      const editableOcr: IneOcrResult | null = frontOcr ?? backOcr;
      const merged: Record<string, string> = {
        ...(backOcr?.data ?? {}),
        ...(frontOcr?.data ?? {}),
      };

      if (!front && !back) {
        onChange(undefined);
        return;
      }

      onChange(
        buildFlatIneAnswer(
          {
            front: front?.fileId ?? null,
            back: back?.fileId ?? null,
            frontOcr: frontOcr ? JSON.stringify(frontOcr.data) : null,
            backOcr: backOcr ? JSON.stringify(backOcr.data) : null,
            ocrData: editableOcr,
          },
          editableOcr
            ? { ...editableOcr, data: merged }
            : null,
          (question.validation_rules ?? {}) as Record<string, unknown>,
        ),
      );
    },
    [onChange, question.validation_rules],
  );

  // Re-emit when the store's files change (draft reload, rehydration).
  useEffect(() => {
    emitAnswer(ineFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey, ineFiles.length]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const side = pendingSide;
    const file = selectedFiles[0];
    setOcrStatus('Procesando OCR...');
    setOcrWarning(null);

    try {
      const compressedFile = await compressInePhoto(file);
      const ocrResult = await recognizeIne(compressedFile, side);

      setOcrStatus(
        `OCR ${SIDE_LABEL[side]} completado (${Math.round(ocrResult.confidence * 100)}% confianza)`,
      );

      if (ocrResult.lowConfidence) {
        setOcrWarning(
          'La lectura no fue muy clara. Verifica los datos antes de enviar.',
        );
      }

      if (ocrResult.validationWarnings.length > 0) {
        setOcrWarning(
          ocrResult.validationWarnings.slice(0, 3).join('. ') + '.',
        );
      }

      setOcrFields((prev) => ({ ...(prev ?? {}), ...ocrResult.data }));

      // Replace only the file for THIS side; keep the other side intact.
      const previous = fileForSide(side);
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      if (previous?.fileId) await deleteFileBlob(previous.fileId);

      const fileId = generateLocalId();
      await saveFileBlob(fileId, responseId || 'draft', compressedFile);

      const next: LocalFilePreview = {
        id: fileId,
        fileId,
        file: compressedFile,
        previewUrl: URL.createObjectURL(compressedFile),
        fileType: sideToFileType(side),
        questionId: question.id.toString(),
        // Store OCR metadata so the sync engine can send it to the backend.
        ineOcrData: JSON.stringify({
          ocr_confidence: ocrResult.confidence,
          ocr_text: ocrResult.text,
          ine_modelo: ocrResult.data.ine_modelo || '',
          ine_ocr_data: ocrResult.data,
        }),
      };

      const others = ineFiles.filter((f) => f.fileType !== sideToFileType(side));
      setFiles(questionKey, [...others, next]);
    } catch (err) {
      console.error('INE OCR failed:', err);
      setOcrStatus('OCR falló');
      setOcrWarning('No se pudo leer el INE. Puedes continuar y verificar manualmente.');
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = async (side: IneSide) => {
    const target = fileForSide(side);
    if (!target) return;
    if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    if (target.fileId) await deleteFileBlob(target.fileId);
    removeFile(questionKey, target.id);
    setOcrStatus(null);
    setOcrWarning(null);
    setOcrFields(null);
  };

  const openCamera = (side: IneSide) => {
    setPendingSide(side);
    inputRef.current?.click();
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
        disabled={disabled}
      />

      <div className={sides.length > 1 ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
        {sides.map((side) => {
          const current = fileForSide(side);
          return (
            <div key={side} className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full h-14 flex-col gap-1"
                onClick={() => openCamera(side)}
                disabled={disabled}
              >
                <Camera className="h-5 w-5" />
                <span className="text-xs">
                  {current ? 'Cambiar' : 'Fotografiar'} {SIDE_LABEL[side]} del INE
                </span>
              </Button>

              {current && (
                <div className="relative rounded-lg border border-input overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.previewUrl}
                    alt={`INE ${SIDE_LABEL[side]}`}
                    className="w-full h-40 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(side)}
                    disabled={disabled}
                    className="absolute top-2 right-2 px-2 py-1 bg-background/90 rounded-full shadow-sm text-xs"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
            .filter(
              ([key, fieldValue]) =>
                fieldValue && key !== 'raw_text' && key !== 'normalized_text' && key !== 'side',
            )
            .slice(0, 8)
            .map(([key, fieldValue]) => (
              <div key={key} className="flex justify-between gap-2">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="font-medium text-right max-w-[60%] break-words">
                  {fieldValue}
                </span>
              </div>
            ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {typeof value === 'object' && value !== null && 'ocrData' in value && (
        <p className="text-xs text-muted-foreground">
          Datos guardados. Puedes recapturar cualquier lado.
        </p>
      )}
    </div>
  );
}
