'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuestionRendererProps } from './question-renderer';

interface ZipValue {
  zip?: string;
  settlement?: string;
}

export function ZipAutofillQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const zipValue: ZipValue =
    value && typeof value === 'object' ? (value as ZipValue) : { zip: String(value ?? '') };

  const [settlement, setSettlement] = useState(zipValue.settlement ?? '');

  const updateZip = (zip: string) => {
    onChange({ zip, settlement });
  };

  const updateSettlement = (nextSettlement: string) => {
    setSettlement(nextSettlement);
    onChange({ zip: zipValue.zip ?? '', settlement: nextSettlement });
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor={`zip-${question.id}`} className="text-sm">
          Código postal
        </Label>
        <Input
          id={`zip-${question.id}`}
          inputSize="mobile"
          inputMode="numeric"
          maxLength={5}
          value={zipValue.zip ?? ''}
          onChange={(e) => updateZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="00000"
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`settlement-${question.id}`} className="text-sm">
          Colonia / asentamiento
        </Label>
        <Input
          id={`settlement-${question.id}`}
          inputSize="mobile"
          value={settlement}
          onChange={(e) => updateSettlement(e.target.value)}
          placeholder="Selecciona o escribe la colonia"
          disabled={disabled}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
