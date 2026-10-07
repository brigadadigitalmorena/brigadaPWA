'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { lookupZipSettlements } from '@/lib/services/datasets.service';
import {
  digitsOnly,
  emptyZipValue,
  formatSettlement,
  isCompleteZip,
  parseZipValue,
  type ZipCompoundValue,
  type ZipSettlement,
} from '@/lib/forms/zip-answer';
import { QuestionRendererProps } from './question-renderer';

export function ZipAutofillQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const zipValue = parseZipValue(value);
  const [zipInput, setZipInput] = useState(zipValue.codigo_postal);
  const [settlements, setSettlements] = useState<ZipSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  const handleZipChange = (raw: string) => {
    const nextZip = digitsOnly(raw);
    setZipInput(nextZip);
    if (!isCompleteZip(nextZip)) {
      setSettlements([]);
      setShowList(false);
      onChange(nextZip ? emptyZipValue(nextZip) : null);
      return;
    }

    onChange(emptyZipValue(nextZip));
    setLoading(true);
    lookupZipSettlements(nextZip)
      .then((rows) => {
        setSettlements(rows);
        setShowList(rows.length > 0);
      })
      .finally(() => setLoading(false));
  };

  const handleSelect = (row: ZipSettlement) => {
    onChange({
      codigo_postal: zipInput,
      colonia: row.colonia,
      tipo: row.tipo,
      municipio: row.municipio,
      estado: row.estado,
      ciudad: row.ciudad,
      zona: row.zona,
    } satisfies ZipCompoundValue);
    setShowList(false);
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
          value={zipInput}
          onChange={(event) => handleZipChange(event.target.value)}
          placeholder="00000"
          disabled={disabled}
        />
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Buscando colonias…</p>
      )}

      {showList && settlements.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-xl border bg-background">
          {settlements.map((row, index) => (
            <li key={`${row.colonia}-${index}`}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                onClick={() => handleSelect(row)}
                disabled={disabled}
              >
                {formatSettlement(row)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {zipValue.colonia && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{zipValue.colonia}</p>
          <p className="text-muted-foreground">{formatSettlement(zipValue)}</p>
          <button
            type="button"
            className="mt-2 text-xs text-primary"
            onClick={() => {
              onChange(emptyZipValue(zipInput));
              setShowList(settlements.length > 0);
              if (settlements.length === 0 && isCompleteZip(zipInput)) {
                handleZipChange(zipInput);
              }
            }}
            disabled={disabled}
          >
            Cambiar colonia
          </button>
        </div>
      )}

      {!loading && isCompleteZip(zipInput) && settlements.length === 0 && !zipValue.colonia && (
        <p className="text-sm text-muted-foreground">
          No encontramos colonias para este C.P. Puedes continuar si el código es correcto.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
