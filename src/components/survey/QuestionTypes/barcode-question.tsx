'use client';

import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  barcodePattern,
  matchesBarcodePattern,
} from '@/lib/forms/field-rules';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { BarcodeScanner } from './barcode-scanner';
import { QuestionRendererProps } from './question-renderer';

export function BarcodeQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const isHidden = normalizeQuestionType(question.question_type) === 'barcode_hidden';
  const pattern = barcodePattern(question.validation_rules);
  const current = typeof value === 'string' ? value : '';
  const patternMismatch =
    current.length > 0 && !matchesBarcodePattern(current, pattern);

  const acceptCode = (next: string) => {
    if (!matchesBarcodePattern(next, pattern)) {
      setScanError('El código no cumple el formato esperado.');
      setScanning(false);
      return;
    }
    setScanError(null);
    setScanning(false);
    onChange(next);
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
          value={current}
          onChange={(e) => {
            setScanError(null);
            onChange(e.target.value);
          }}
          placeholder="Código escaneado o manual"
          disabled={disabled}
          aria-invalid={!!error}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="mobile"
          onClick={() => setScanning(true)}
          disabled={disabled}
          aria-label="Escanear código"
        >
          <ScanBarcode className="h-5 w-5" />
        </Button>
      </div>

      {patternMismatch && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          El código no cumple el formato esperado.
        </p>
      )}
      {scanError && <p className="text-sm text-amber-600 dark:text-amber-400">{scanError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {scanning && (
        <BarcodeScanner
          onDetect={acceptCode}
          onClose={(message) => {
            setScanning(false);
            if (message) setScanError(message);
          }}
        />
      )}
    </div>
  );
}
