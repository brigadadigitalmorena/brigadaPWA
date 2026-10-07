'use client';

import { useRef, useState } from 'react';
import { ScanLine, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { recognizeIne } from '@/lib/services/ine-ocr.service';
import { saveFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import { compressInePhoto } from '@/lib/services/image-compression.service';
import { parseIneOcrText, loadCorrections, saveCorrection } from '@/lib/ocr';
import type { IneOcrResult } from '@/lib/ocr/ine-ocr-parser';
import type { ParsedAddress } from '@/lib/ocr/ine-address';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import {
  parseIneValue,
  patchAddressField,
  patchOcrField,
  type IneAnswer,
} from '@/lib/forms/ine-answer';
import { QuestionRendererProps } from './question-renderer';
import { IneOcrEditor } from './ine-ocr-editor';
import { IneSideCapture } from './ine-side-capture';

type IneSide = 'front' | 'back';

function sidesForType(questionType: string | undefined): IneSide[] {
  const type = normalizeQuestionType(questionType);
  if (type === 'ine_back') return ['back'];
  if (type === 'ine_front') return ['front'];
  return ['front', 'back'];
}

export function IneQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const { files, setFiles, removeFile, responseId } = useSurveyFillStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [captureSide, setCaptureSide] = useState<IneSide>('front');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);

  const questionKey = question.question_key || question.id.toString();
  const ineFiles = files[questionKey] || [];
  const sides = sidesForType(question.question_type);
  const answer = parseIneValue(value);

  const persistAnswer = (next: IneAnswer) => onChange(next);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const side = captureSide;
    setOcrStatus('Procesando OCR...');
    setOcrWarning(null);

    try {
      const compressedFile = await compressInePhoto(selected);
      const ocrResult = await recognizeIne(compressedFile, side);
      const corrections = await loadCorrections();
      const previous = ineFiles.find((file) => file.fileType === `ine_${side}`);
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      if (previous?.fileId) await deleteFileBlob(previous.fileId);

      const fileId = generateLocalId();
      await saveFileBlob(fileId, responseId || 'draft', compressedFile);

      const nextFiles = [
        ...ineFiles.filter((file) => file.fileType !== `ine_${side}`),
        {
          id: fileId,
          fileId,
          file: compressedFile,
          previewUrl: URL.createObjectURL(compressedFile),
          fileType: `ine_${side}`,
          questionId: question.id.toString(),
          ineOcrData: JSON.stringify({
            ocr_confidence: ocrResult.confidence,
            ocr_text: ocrResult.text,
            ine_modelo: ocrResult.parsed.modeloDetected,
            ine_ocr_data: ocrResult.parsed,
          }),
        },
      ];
      setFiles(questionKey, nextFiles);

      const nextAnswer: IneAnswer = {
        ...answer,
        [side]: fileId,
        [`${side}Text`]: ocrResult.text,
      };
      nextAnswer.ocrData = parseIneOcrText(
        nextAnswer.frontText ?? null,
        nextAnswer.backText ?? null,
        undefined,
        undefined,
        undefined,
        corrections
      );
      persistAnswer(nextAnswer);

      setOcrStatus(`OCR completado (${Math.round(ocrResult.confidence * 100)}%)`);
      if (ocrResult.lowConfidence || ocrResult.validationWarnings.length > 0) {
        setOcrWarning(
          ocrResult.validationWarnings.slice(0, 3).join('. ') ||
            'La lectura no fue muy clara. Verifica los datos.'
        );
      }
    } catch (err) {
      console.error('INE OCR failed:', err);
      setOcrStatus('OCR falló');
      setOcrWarning('No se pudo leer el INE. Puedes capturar de nuevo o llenar a mano.');
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (side: IneSide) => {
    const existing = ineFiles.find((file) => file.fileType === `ine_${side}`);
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);
    if (existing?.fileId) await deleteFileBlob(existing.fileId);
    if (existing) removeFile(questionKey, existing.id);
    persistAnswer({
      ...answer,
      [side]: null,
      [`${side}Text`]: null,
      ocrData: sides.length === 1 ? null : answer.ocrData,
    });
  };

  const handleFieldChange = async (field: keyof IneOcrResult, nextValue: string) => {
    const previous = String(answer.ocrData?.[field] ?? '');
    persistAnswer({ ...answer, ocrData: patchOcrField(answer.ocrData, field, nextValue) });
    if (previous && nextValue.trim() && previous !== nextValue) {
      await saveCorrection(field as Parameters<typeof saveCorrection>[0], previous, nextValue);
    }
  };

  const handleAddressChange = (field: keyof ParsedAddress, nextValue: string) => {
    persistAnswer({
      ...answer,
      ocrData: patchAddressField(answer.ocrData, field, nextValue),
    });
  };

  const openCapture = (side: IneSide) => {
    setCaptureSide(side);
    requestAnimationFrame(() => inputRef.current?.click());
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
        disabled={disabled}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map((side) => (
          <IneSideCapture
            key={side}
            side={side}
            preview={ineFiles.find((file) => file.fileType === `ine_${side}`)}
            disabled={disabled}
            onCapture={openCapture}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {ocrStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          {ocrStatus}
        </div>
      )}
      {ocrWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {ocrWarning}
        </div>
      )}

      <IneOcrEditor
        ocrData={answer.ocrData}
        onFieldChange={handleFieldChange}
        onAddressChange={handleAddressChange}
        disabled={disabled}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
