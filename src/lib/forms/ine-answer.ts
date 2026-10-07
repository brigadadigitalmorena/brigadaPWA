/**
 * INE compound answer helpers — portable subset of the mobile OCR contract.
 * The survey answer is one object `{ front, back, ocrData }` so JSONLogic and
 * `metadata.ocr_autofill` can read extracted fields.
 */

import type { Question } from '@/lib/types';
import {
  DEFAULT_REQUIRED_INE_FIELDS,
  INE_REQUIRED_FIELD_LABELS,
} from '@/lib/ocr/ine-required-fields';
import type { IneOcrResult } from '@/lib/ocr/ine-ocr-parser';
import type { ParsedAddress } from '@/lib/ocr/ine-address';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export const INE_QUESTION_TYPES = new Set([
  'ine_ocr',
  'ine',
  'credential',
  'ine_front',
  'ine_back',
]);

export type IneAnswer = {
  front: string | null;
  back: string | null;
  frontText?: string | null;
  backText?: string | null;
  ocrData: IneOcrResult | null;
};

export type OcrAutofillConfig = {
  source_question_key?: string;
  source_field?: string;
  allow_manual_override?: boolean;
};

const LEGACY_OCR_FIELD_ALIASES: Record<string, string> = {
  apellido_paterno: 'apellidoPaterno',
  apellido_materno: 'apellidoMaterno',
  clave_elector: 'claveElector',
  fecha_nacimiento: 'fechaNacimiento',
  nombre_completo: 'nombre',
  codigo_postal: 'domicilioDesglosado.codigoPostal',
};

const OPTIONAL_LEGACY_REQUIRED = new Set(['ocrNumber']);

export function isIneQuestionType(raw: string | undefined | null): boolean {
  return INE_QUESTION_TYPES.has(normalizeQuestionType(raw));
}

export function emptyIneOcrData(): IneOcrResult {
  return {
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    claveElector: '',
    ocrNumber: '',
    cic: '',
    curp: '',
    fechaNacimiento: '',
    sexo: '',
    seccion: '',
    registro: '',
    vigencia: '',
    domicilio: '',
    domicilioDesglosado: {
      calle: '',
      colonia: '',
      codigoPostal: '',
      municipio: '',
      estado: '',
    },
    modeloDetected: 'unknown',
    confidence: 0,
    fieldConfidence: {
      nombre: 0,
      apellidoPaterno: 0,
      apellidoMaterno: 0,
      claveElector: 0,
      ocrNumber: 0,
      cic: 0,
      curp: 0,
      fechaNacimiento: 0,
      sexo: 0,
      seccion: 0,
      registro: 0,
      vigencia: 0,
      domicilio: 0,
    },
    correctionsApplied: 0,
  };
}

export function parseIneValue(value: unknown): IneAnswer {
  if (!value) {
    return { front: null, back: null, ocrData: null };
  }
  if (typeof value === 'string') {
    return { front: value, back: null, ocrData: null };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { front: null, back: null, ocrData: null };
  }

  const raw = value as Record<string, unknown>;
  return {
    front: asNullableString(raw.front),
    back: asNullableString(raw.back),
    frontText: asNullableString(raw.frontText),
    backText: asNullableString(raw.backText),
    ocrData: parseOcrData(raw.ocrData),
  };
}

export function normalizeIneRequiredFields(
  requiredFields: string[] = [],
  questionType?: string
): string[] {
  const normalized = requiredFields.filter(
    (field) => !OPTIONAL_LEGACY_REQUIRED.has(field)
  );
  const type = normalizeQuestionType(questionType);
  if (type === 'ine_front') {
    return normalized.filter((field) => field !== 'back');
  }
  if (type === 'ine_back') {
    return normalized.filter((field) => field !== 'front');
  }
  return normalized;
}

export function resolveRequiredIneFields(question: Question): string[] {
  const rules = (question.validation_rules ?? {}) as Record<string, unknown>;
  const configured = Array.isArray(rules.required_fields)
    ? (rules.required_fields as unknown[]).map(String)
    : Array.isArray(rules.requiredFields)
      ? (rules.requiredFields as unknown[]).map(String)
      : [];

  const type = normalizeQuestionType(question.question_type);
  if (configured.length > 0) {
    const withSides = ['front', 'back', ...configured];
    return [
      ...new Set(normalizeIneRequiredFields(withSides, question.question_type)),
    ];
  }

  if (!question.is_required) {
    if (type === 'ine_front') return ['front'];
    if (type === 'ine_back') return ['back'];
    return ['front', 'back'];
  }

  return normalizeIneRequiredFields(
    [...DEFAULT_REQUIRED_INE_FIELDS],
    question.question_type
  );
}

export function getMissingRequiredIneFields(
  value: unknown,
  requiredFields: string[]
): string[] {
  const data = parseIneValue(value);
  return requiredFields.filter((field) => {
    if (field === 'front' || field === 'back') {
      return isBlank(data[field]);
    }
    if (field === 'ocrData') return !data.ocrData;
    const ocr = data.ocrData as Record<string, unknown> | null;
    return isBlank(ocr?.[field]);
  });
}

export function formatMissingIneFields(fields: string[]): string {
  const labels = fields.map(
    (field) => INE_REQUIRED_FIELD_LABELS[field] ?? field
  );
  if (labels.length === 1) {
    return `Falta ${labels[0]} de la credencial`;
  }
  return `Faltan datos de la INE: ${labels.join(', ')}`;
}

export function getIneOcrFieldValue(
  value: unknown,
  sourceField: string
): unknown {
  const data = parseIneValue(value);
  if (!data.ocrData) return undefined;
  const path = LEGACY_OCR_FIELD_ALIASES[sourceField] ?? sourceField;
  return getValueByPath(data.ocrData as unknown as Record<string, unknown>, path);
}

export function applyOcrAutofill(params: {
  sourceQuestionKey: string;
  sourceValue: unknown;
  fields: Question[];
  answers: Record<string, unknown>;
}): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const { sourceQuestionKey, sourceValue, fields, answers } = params;

  for (const field of fields) {
    const targetKey = field.question_key || field.id.toString();
    if (targetKey === sourceQuestionKey) continue;

    const metadata = (field.metadata ?? null) as Record<string, unknown> | null;
    const autofill = metadata?.ocr_autofill as OcrAutofillConfig | undefined;
    if (!autofill?.source_question_key || !autofill.source_field) continue;
    if (autofill.source_question_key !== sourceQuestionKey) continue;

    const source = getIneOcrFieldValue(sourceValue, autofill.source_field);
    if (isBlank(source)) continue;

    const existing = answers[targetKey];
    const allowManualOverride = autofill.allow_manual_override !== false;
    if (allowManualOverride && !isBlank(existing)) continue;
    if (existing === source) continue;

    updates[targetKey] = source;
  }

  return updates;
}

export function patchOcrField(
  ocrData: IneOcrResult | null,
  field: keyof IneOcrResult,
  nextValue: string
): IneOcrResult {
  const base = ocrData ?? emptyIneOcrData();
  const value = nextValue.trim();
  return {
    ...base,
    [field]: value,
    fieldConfidence: {
      ...base.fieldConfidence,
      [field]: value ? 1 : 0,
    },
  };
}

export function patchAddressField(
  ocrData: IneOcrResult | null,
  field: keyof ParsedAddress,
  nextValue: string
): IneOcrResult {
  const base = ocrData ?? emptyIneOcrData();
  const current = base.domicilioDesglosado ?? {
    calle: '',
    colonia: '',
    codigoPostal: '',
    municipio: '',
    estado: '',
  };
  const updated: ParsedAddress = {
    ...current,
    [field]: nextValue,
  };
  const domicilio = [
    updated.calle.trim(),
    updated.colonia.trim() ? `COL. ${updated.colonia.trim()}` : '',
    updated.codigoPostal.trim() ? `C.P. ${updated.codigoPostal.trim()}` : '',
    updated.municipio.trim(),
    updated.estado.trim(),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    ...base,
    domicilioDesglosado: updated,
    domicilio,
    fieldConfidence: {
      ...base.fieldConfidence,
      domicilio: domicilio ? 1 : 0,
    },
  };
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOcrData(value: unknown): IneOcrResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<IneOcrResult>;
  const empty = emptyIneOcrData();
  return {
    ...empty,
    ...raw,
    domicilioDesglosado: {
      ...empty.domicilioDesglosado!,
      ...(raw.domicilioDesglosado ?? {}),
    },
    fieldConfidence: {
      ...empty.fieldConfidence,
      ...(raw.fieldConfidence ?? {}),
    },
  };
}

function getValueByPath(
  source: Record<string, unknown>,
  path: string
): unknown {
  const segments = path.split('.').filter(Boolean);
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
