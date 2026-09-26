/**
 * Build Flat INE Answer
 *
 * Creates a flat snake_case object + nested `ocrData` for INE answers,
 * matching the backend's expected format and enabling JSONLogic access
 * to sub-fields like `answers.q_ine.curp`.
 *
 * Mirrors brigadaApp/components/survey/ine-question.tsx:buildFlatIneAnswer
 */

import type { IneOcrResult } from '@/lib/services/ine-ocr.service';

export interface IneAnswerData {
  front: string | null;
  back: string | null;
  front_ocr: string | null;
  back_ocr: string | null;
  nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  curp?: string;
  fecha_nacimiento?: string;
  sexo?: string;
  seccion?: string;
  clave_elector?: string;
  cic?: string;
  ocr_number?: string;
  domicilio?: string;
  vigencia?: string;
  registro?: string;
  modelo_detectado?: string;
  confidence?: number;
  ocrData: IneOcrResult | null;
}

/**
 * Builds the flat INE answer object from OCR data.
 * Returns a flat object with snake_case keys + nested `ocrData`.
 */
export function buildFlatIneAnswer(
  data: {
    front: string | null;
    back: string | null;
    frontOcr: string | null;
    backOcr: string | null;
    ocrData: IneOcrResult | null;
  },
  editableOcr: IneOcrResult | null,
  validationRules?: Record<string, unknown>,
): IneAnswerData {
  const ocr = editableOcr ?? data.ocrData;
  const base = {
    front: data.front,
    back: data.back,
    front_ocr: data.frontOcr,
    back_ocr: data.backOcr,
  };

  if (!ocr) return { ...base, ocrData: null };

  // The OCR data is in the `data` property of IneOcrResult
  const ocrData = ocr.data as Record<string, string>;

  const isEnabled = (key: string) =>
    validationRules?.[`extract_${key}`] !== false;

  const getValue = (key: string, fallback = '') => {
    if (!isEnabled(key)) return undefined;
    const value = ocrData[key];
    return value !== undefined && value !== null && value !== '' ? value : fallback;
  };

  return {
    ...base,
    ...(isEnabled('nombre') && { nombre: getValue('nombre') }),
    ...(isEnabled('apellido_paterno') && {
      apellido_paterno: getValue('apellidoPaterno'),
    }),
    ...(isEnabled('apellido_materno') && {
      apellido_materno: getValue('apellidoMaterno'),
    }),
    ...(isEnabled('curp') && { curp: getValue('curp') }),
    ...(isEnabled('fecha_nacimiento') && {
      fecha_nacimiento: getValue('fechaNacimiento'),
    }),
    ...(isEnabled('sexo') && { sexo: translateSexo(getValue('sexo') ?? '') }),
    ...(isEnabled('seccion') && { seccion: getValue('seccion') }),
    ...(isEnabled('clave_elector') && {
      clave_elector: getValue('claveElector'),
    }),
    ...(isEnabled('cic') && { cic: getValue('cic') }),
    ...(isEnabled('ocr_number') && { ocr_number: getValue('ocrNumber') }),
    ...(isEnabled('domicilio') && { domicilio: getValue('domicilio') }),
    ...(isEnabled('vigencia') && { vigencia: getValue('vigencia') }),
    ...(isEnabled('registro') && { registro: getValue('registro') }),
    ...(isEnabled('modelo_detectado') && {
      modelo_detectado: getValue('modeloDetected') ?? 'unknown',
    }),
    ...(isEnabled('confidence') && { confidence: ocr.confidence ?? 0 }),
    ocrData: ocr,
  };
}

/**
 * Translates sexo code to Spanish label.
 * H → Hombre, M → Mujer, X/NB → No binario
 */
function translateSexo(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized === 'H') return 'Hombre';
  if (normalized === 'M') return 'Mujer';
  if (normalized === 'X' || normalized === 'NB') return 'No binario';
  return code;
}

/**
 * Parse the current INE answer value into a structured format.
 * Used to extract front/back/OCR data from existing answer.
 */
export function parseIneValue(value: unknown): {
  front: string | null;
  back: string | null;
  frontOcr: string | null;
  backOcr: string | null;
  ocrData: import('@/lib/services/ine-ocr.service').IneOcrResult | null;
} {
  if (typeof value === 'string') {
    return { front: value, back: null, frontOcr: null, backOcr: null, ocrData: null };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { front: null, back: null, frontOcr: null, backOcr: null, ocrData: null };
  }
  const data = value as Record<string, unknown>;
  return {
    front: (data.front as string) ?? null,
    back: (data.back as string) ?? null,
    frontOcr: (data.front_ocr as string) ?? null,
    backOcr: (data.back_ocr as string) ?? null,
    ocrData:
      data.ocrData && typeof data.ocrData === 'object' && !Array.isArray(data.ocrData)
        ? (data.ocrData as import('@/lib/services/ine-ocr.service').IneOcrResult)
        : null,
  };
}