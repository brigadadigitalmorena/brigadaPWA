'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IneOcrResult } from '@/lib/ocr/ine-ocr-parser';
import type { ParsedAddress } from '@/lib/ocr/ine-address';
import { INE_REQUIRED_FIELD_LABELS } from '@/lib/ocr/ine-required-fields';

const TEXT_FIELDS: Array<keyof IneOcrResult> = [
  'nombre',
  'apellidoPaterno',
  'apellidoMaterno',
  'curp',
  'claveElector',
  'fechaNacimiento',
  'sexo',
  'seccion',
  'vigencia',
  'cic',
];

const ADDRESS_FIELDS: Array<{ key: keyof ParsedAddress; label: string }> = [
  { key: 'calle', label: 'Calle' },
  { key: 'colonia', label: 'Colonia' },
  { key: 'codigoPostal', label: 'C.P.' },
  { key: 'municipio', label: 'Municipio' },
  { key: 'estado', label: 'Estado' },
];

interface IneOcrEditorProps {
  ocrData: IneOcrResult | null;
  onFieldChange: (field: keyof IneOcrResult, value: string) => void;
  onAddressChange: (field: keyof ParsedAddress, value: string) => void;
  disabled?: boolean;
}

export function IneOcrEditor({
  ocrData,
  onFieldChange,
  onAddressChange,
  disabled,
}: IneOcrEditorProps) {
  if (!ocrData) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-sm font-medium">Datos leídos — verifica y corrige</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map((field) => {
          const value = String(ocrData[field] ?? '');
          const confidence = ocrData.fieldConfidence[field as keyof typeof ocrData.fieldConfidence];
          const low = value.length > 0 && confidence < 0.6;
          return (
            <div key={field} className="space-y-1">
              <Label htmlFor={`ine-${field}`} className="text-xs text-muted-foreground">
                {INE_REQUIRED_FIELD_LABELS[field] ?? field}
                {low ? ' (revisar)' : ''}
              </Label>
              <Input
                id={`ine-${field}`}
                inputSize="mobile"
                value={value}
                onChange={(event) => onFieldChange(field, event.target.value)}
                disabled={disabled}
                className={low ? 'border-amber-400' : undefined}
                autoCapitalize="characters"
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground">Domicilio</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ADDRESS_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`ine-addr-${key}`} className="text-xs text-muted-foreground">
                {label}
              </Label>
              <Input
                id={`ine-addr-${key}`}
                inputSize="mobile"
                value={ocrData.domicilioDesglosado?.[key] ?? ''}
                onChange={(event) => onAddressChange(key, event.target.value)}
                disabled={disabled}
                autoCapitalize="characters"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
