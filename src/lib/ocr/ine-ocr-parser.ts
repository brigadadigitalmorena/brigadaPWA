/**
 * 🪪 INE OCR Parser
 * =================
 * Extrae campos estructurados del texto crudo devuelto por ML Kit
 * cuando se fotografía una Credencial para Votar (INE/IFE de México).
 *
 * ── Decisiones de diseño ────────────────────────────────────────────────────
 *
 * 1. MÓDULO SEPARADO
 *    El algoritmo se extrae de ine-question.tsx a este módulo para que sea
 *    testeable de forma unitaria (jest/vitest) sin montar ningún componente
 *    React. La función `parseIneOcrText` recibe texto plano y devuelve un
 *    objeto tipado — sin efectos secundarios.
 *
 * 2. DOS FASES: NORMALIZACIÓN → EXTRACCIÓN
 *    Phase 1 – normalizeOcrText: limpia el texto crudo antes de cualquier
 *    regex. ML Kit devuelve líneas con basura (caracteres de borde de tarjeta,
 *    saltos dobles, caracteres de marca de agua "INSTITUTO NACIONAL ELECTORAL").
 *    Phase 2 – parseIneOcrText: ya con texto limpio, aplica las estrategias
 *    de extracción en orden de confianza (strict → heuristic → fuzzy).
 *
 * 3. MAPA DE CONFUSIÓN DE CARACTERES (OCR)
 *    La cámara de un teléfono en condiciones reales produce errores predecibles:
 *      O ↔ 0,  I ↔ 1 ↔ L,  B ↔ 8,  S ↔ 5,  Z ↔ 2,  G ↔ 6,  Q ↔ 0
 *    Para CURP y Clave de Elector, donde el formato es determinístico
 *    (posición a posición: letras vs dígitos), se aplica la corrección
 *    inversa antes del regex. Esto evita rechazar un CURP válido porque
 *    el OCR leyó "PATR8301" en vez de "PATRB301".
 *
 * 4. ESTRATEGIA POR CAMPO (strict > heuristic > fallback)
 *    Cada campo tiene hasta 3 niveles:
 *      - strict:    regex con patrón fuerte (p.ej. CURP: 18 chars específicos)
 *      - heuristic: buscar la línea siguiente a la etiqueta del campo en el
 *                   texto (p.ej. línea después de "NOMBRE")
 *      - fallback:  heurística posicional o candidato más probable sin etiqueta
 *    Se guarda en `fieldMethod` para calcular confianza por campo.
 *
 * 5. CONFIANZA POR CAMPO, NO GLOBAL
 *    La confianza anterior era una media ponderada de bloques ML Kit, lo que
 *    no reflejaba si los campos se extrajeron o no. Ahora:
 *      - Strict match  → 1.0
 *      - Heuristic     → 0.75
 *      - Fuzzy/fallback→ 0.45
 *      - No encontrado → 0.0
 *    `overallConfidence` = media de los campos con valor ÷ total de campos.
 *    La UI puede pintar campo a campo con el color adecuado.
 *
 * 6. SOPORTE MULTI-VERSIÓN INE
 *    Se han emitido al menos 4 modelos desde 2008:
 *      MODELO_A: IFE 2008 — etiquetas en español, layout horizontal
 *      MODELO_B: IFE 2013 — añade QR, fuente diferente
 *      MODELO_C: INE 2015 — rediseño, "CURP" visible en anverso
 *      MODELO_D: INE 2019 — Modelo F, chip NFC, fuente sans-serif más pequeña
 *    Se detecta el modelo a partir de tokens característicos y se ajustan las
 *    estrategias (p.ej. en Modelo C/D el CURP está en el frente; en A/B solo
 *    en el reverso).
 *
 * 7. NOMBRES: ESTRATEGIAS EN CASCADA
 *    INE tiene tres campos: APELLIDO PATERNO, APELLIDO MATERNO, NOMBRE(S).
 *    Estrategia A – etiquetas explícitas: si hay línea "APELLIDO PATERNO"
 *      tomar la siguiente línea no-etiqueta.
 *    Estrategia B – bloque de nombre en frente: las 2–3 líneas en mayúsculas
 *      que preceden al CURP o a la fecha de nacimiento.
 *    Estrategia C – derivar desde CURP: los 4 primeros caracteres codifican
 *      inicial-apellido-paterno + inicial-apellido-materno + iniciales-nombre.
 *      Si lo único que tenemos es el CURP, al menos podemos sugerir iniciales.
 *
 * 8. DOMICILIO: RECOLECCIÓN MULTI-LÍNEA
 *    El FRENTE de la INE tiene el domicilio entre los nombres y el CURP,
 *    en 2–6 líneas seguidas. Se recolectan hasta la primera línea que
 *    parece una etiqueta de campo (CLAVE, CURP, SECCIÓN, etc.) o hasta
 *    máximo 6 líneas. Se buscan múltiples anclas: "DOMICILIO", "COL.",
 *    "C.P.", "AV ", "BLVD". El reverso se busca como fallback para
 *    modelos antiguos de IFE.
 *
 * 10. MODELO HINT (USUARIO)
 *    El brigadista puede pre-seleccionar el tipo de INE antes de capturar.
 *    Cuando se provee un `modeloHint`, se usa como modelo detectado si la
 *    auto-detección falla (modelo "unknown"). Esto mejora significativamente
 *    la precisión de extracción de nombres y domicilios cuando el OCR del
 *    texto institucional es ilegible (reflejo en holograma, etc.).
 *
 * 9. FECHAS: 3 FORMATOS
 *    INE ha usado al menos tres formatos de fecha:
 *      - DD/MM/YYYY  (más común, modelos A-C)
 *      - DD MMM YYYY (p.ej. "05 ENE 1990", modelos C-D)
 *      - DDMMYYYY    (sin separadores, cuando OCR pega dígitos)
 *    Se normalizan todos a DD/MM/YYYY para consistencia.
 *
 * ── Limitaciones conocidas ──────────────────────────────────────────────────
 *    - ML Kit no garantiza orden de bloques; usamos heurísticas de posición
 *      relativa entre etiquetas, no coordenadas absolutas (esas requieren
 *      la API Premium de Vision).
 *    - Credenciales muy dañadas o plastificadas con reflejo intenso pueden
 *      producir texto demasiado ruidoso para extraer nombres.
 *    - No se maneja la MRZ (Machine Readable Zone) que tienen algunos modelos
 *      en el reverso — puede confundir el regex de CURP con cadenas similares.
 */

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  extractAddressFromSpatialExpert,
  extractDomicilioExpert,
  parseAddressComponents,
  type ParsedAddress,
} from "./ine-address";
import { parseMrz } from "./ine-mrz";
import {
  classifyBackBlocks,
  classifyFrontBlocks,
  extractNamesFromSpatial,
  type OcrBlock,
} from "./ine-spatial";
import {
  correctNameFromDictionary,
  fixNameOcr,
  matchCurpInitials,
  scoreAsApellido,
  scoreAsNombre,
} from "./mexican-names";
import { applyFieldCorrection, type FieldCorrections } from "./ocr-corrections";

// Re-export OcrBlock and ParsedAddress for use by consumers
export type { OcrBlock, ParsedAddress };

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Resultado de la extracción OCR con confianza por campo */
export interface IneOcrResult {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  claveElector: string;
  /** OCR Number — variable-length identifier tras `>>>` (legacy field, separately extracted) */
  ocrNumber: string;
  /**
   * CIC (Clave de Identificación de Credencial) — 9-digit MRZ document number (preferred).
   * Fallback: 10-15 digits tras `<<` if MRZ absent. Extracted separately from ocrNumber.
   * MRZ strategy: extract after `I<MEX`/`IDMEX` (0.98 confidence),
   * explicit label CIC (0.9), legacy << (0.68-0.72 fallback).
   */
  cic: string;
  curp: string;
  fechaNacimiento: string; // formato DD/MM/YYYY
  sexo: string; // "H" | "M"
  seccion: string;
  registro: string; // año de registro YYYY
  vigencia: string; // año YYYY
  domicilio: string;
  /** Domicilio desglosado en sub-componentes estructurados */
  domicilioDesglosado?: ParsedAddress;
  /** Best-effort source region for field review/cropping in the OCR editor. */
  fieldSources?: Partial<Record<IneTextField, IneOcrSourceRegion>>;
  /** Modelo de credencial detectado (Decisión §6) */
  modeloDetected: IneModelo;
  /** Confianza global 0–1 calculada como media de campos con valor */
  confidence: number;
  /** Confianza individual 0–1 por campo (para UI por campo) */
  fieldConfidence: Record<
    keyof Omit<
      IneOcrResult,
      | "confidence"
      | "fieldConfidence"
      | "modeloDetected"
      | "domicilioDesglosado"
      | "fieldSources"
      | "correctionsApplied"
    >,
    number
  >;
  /**
   * O-OP-8: Cantidad de campos cuyo valor crudo del OCR fue sustituido por una
   * corrección aprendida (Decisión: OCR learning). Se usa para telemetría:
   * `ocr.processed.corrections_applied` permite medir deriva del parser.
   */
  correctionsApplied: number;
}

/**
 * Campos de texto editables del resultado OCR.
 * Excluye los metadatos (confianza, modelo, desglose de domicilio).
 */
export type IneTextField = keyof Omit<
  IneOcrResult,
  | "confidence"
  | "fieldConfidence"
  | "modeloDetected"
  | "domicilioDesglosado"
  | "fieldSources"
  | "correctionsApplied"
>;

export interface IneOcrSourceRegion {
  side: "front" | "back";
  /** Normalized source image ratios (0..1), padded for human review. */
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  method?: string;
  confidence?: number;
}

/** Versión del modelo de credencial detectada */
export type IneModelo =
  | "A_IFE2008"
  | "B_IFE2013"
  | "C_INE2015"
  | "D_INE2019"
  | "unknown";

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Mapa de confusión OCR: carácter frecuentemente leído → corrección esperada.
 * Se aplica selectivamente según si la posición en el campo debe ser letra o dígito.
 * (Decisión §3)
 */
const OCR_DIGIT_TO_LETTER: Record<string, string> = {
  "0": "O",
  "1": "I",
  "8": "B",
  "5": "S",
  "2": "Z",
  "6": "G",
  "9": "P",
};
const OCR_LETTER_TO_DIGIT: Record<string, string> = {
  O: "0",
  I: "1",
  L: "1",
  B: "8",
  S: "5",
  Z: "2",
  G: "6",
};

/**
 * OCR del reverso: dígitos impresos después del marcador `>>>`.
 * Suele aparecer como un bloque numérico separado del resto de campos.
 */
const OCR_NUMBER_RE = />{3,}\s*([0-9][0-9\s-]{4,})/;

/**
 * CIC del reverso. En MRZ TD1 de INE modernas suele ser el número de
 * documento: los 9 dígitos inmediatamente posteriores a `I<MEX` / `IDMEX`.
 * ML Kit puede leer `<` como K, D, (, { o separarlo con espacios.
 *
 * El bloque después de `<<` se conserva como fallback porque credenciales o
 * lecturas antiguas pueden exponer ahí el identificador; no debe ganar sobre
 * el número de documento MRZ, ya que suele corresponder a otro identificador.
 *
 * LÍMITES para evitar confusión con OCR Number (tras `>>>`):
 *   - MRZ doc: exactamente 9 dígitos
 *   - Fallback `<<`: 10-15 máximo — OCR Number es variable, no entra aquí
 */
const CIC_AFTER_DOUBLE_FILLER_RE =
  /(?:<{2,}|K{2,}|D{2,}|\({2,}|\[{2,}|\{{2,})\s*([0-9OQILSBZG\s-]{10,15})/;
const CIC_MRZ_DOC_RE = /I\s*[<KD({\[]?\s*MEX\s*([0-9OQILSBZG\s-]{9,14})/;

function normalizeCicDigits(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL|]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/Z/g, "2")
    .replace(/G/g, "6")
    .replace(/\D/g, "");
}

function takeCicLength(digits: string): string {
  if (digits.length >= 9) return digits.slice(0, 9);
  return digits;
}

function extractOcrNumber(
  normalizedBackText: string,
): { value: string; confidence: number } | null {
  const lines = normalizedBackText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);

  for (const line of lines) {
    const match = line.match(OCR_NUMBER_RE);
    if (!match) continue;

    const digits = match[1].replace(/\D/g, "");
    if (digits.length < 6) continue;

    return {
      value: digits,
      confidence: digits.length >= 10 ? 0.95 : 0.8,
    };
  }

  const flattenedMatch = normalizedBackText
    .replace(/\n+/g, " ")
    .match(OCR_NUMBER_RE);
  if (flattenedMatch) {
    const digits = flattenedMatch[1].replace(/\D/g, "");
    if (digits.length >= 6) {
      return {
        value: digits,
        confidence: digits.length >= 10 ? 0.9 : 0.75,
      };
    }
  }

  return null;
}

/**
 * Extrae el CIC (Clave de Identificación de Credencial) del texto CRUDO
 * del reverso. Prioriza número de documento MRZ (9 dígitos tras MEX) y
 * conserva fallback de `<<digits` para OCR/layouts antiguos.
 *
 * DEBE usarse con texto CRUDO (antes de normalizeOcrText) porque la
 * normalización elimina líneas que contienen `<`.
 */
function extractCic(
  rawBackText: string | null,
): { value: string; confidence: number } | null {
  if (!rawBackText) return null;

  const lines = rawBackText
    .split("\n")
    .map((line) => line.trim().toUpperCase())
    .filter((line) => line.length >= 10);

  // Estrategia 1: MRZ TD1 línea 1 — I<MEX / IDMEX + 9 dígitos de documento.
  for (const line of lines) {
    const match = line.match(CIC_MRZ_DOC_RE);
    if (!match) continue;
    const digits = takeCicLength(normalizeCicDigits(match[1]));
    if (digits.length >= 9) {
      return {
        value: digits,
        confidence: digits.length === 9 ? 0.98 : 0.9,
      };
    }
  }

  // Estrategia 2: etiqueta explícita CIC cerca del valor.
  for (const line of lines) {
    if (!/\bC[I1]C\b/.test(line)) continue;
    const digits = normalizeCicDigits(line.replace(/\bC[I1]C\b/g, ""));
    if (digits.length >= 9) {
      return {
        value: digits.slice(0, Math.min(digits.length, 20)),
        confidence: 0.9,
      };
    }
  }

  // Estrategia 3: Buscar <<DIGITS en cualquier línea (fallback histórico).
  // Excluye líneas con OCR Number (tras >>>) para no contaminar campos.
  for (const line of lines) {
    if (line.includes(">>>")) continue; // OCR Number field separado

    const match = line.match(CIC_AFTER_DOUBLE_FILLER_RE);
    if (!match) continue;
    const digits = normalizeCicDigits(match[1]);
    if (digits.length >= 10 && digits.length <= 15) {
      return {
        value: digits.slice(0, Math.min(digits.length, 20)),
        confidence: digits.length >= 13 ? 0.72 : 0.68,
      };
    }
  }

  return null;
}

type IneFooterField = "seccion" | "registro" | "vigencia";

function validSeccion(value: string): boolean {
  const n = parseInt(value, 10);
  return /^\d{3,4}$/.test(value) && n >= 1 && n <= 9300;
}

function validRegistro(value: string): boolean {
  const n = parseInt(value, 10);
  const currentYear = new Date().getFullYear();
  return /^\d{4}$/.test(value) && n >= 1991 && n <= currentYear;
}

function validVigencia(value: string): boolean {
  const n = parseInt(value, 10);
  return /^\d{4}$/.test(value) && n >= 2025 && n <= 2040;
}

function extractBestVigenciaYear(raw: string): string | null {
  const years = Array.from(raw.matchAll(/\b(?:20)\d{2}\b/g)).map((match) =>
    parseInt(match[0], 10),
  );
  if (years.length === 0) return null;
  // In ranges like "2022-2032", business value is the ending validity year.
  const best = Math.max(...years);
  const formatted = String(best);
  return validVigencia(formatted) ? formatted : null;
}

function isValidFooterValue(field: IneFooterField, value: string): boolean {
  if (field === "seccion") return validSeccion(value);
  if (field === "registro") return validRegistro(value);
  return validVigencia(value);
}

function detectFooterLabels(
  line: string,
): { field: IneFooterField; index: number }[] {
  const labels: { field: IneFooterField; index: number }[] = [];
  const patterns: { field: IneFooterField; re: RegExp }[] = [
    { field: "seccion", re: /SECCI[OÓ0]N/i },
    {
      field: "registro",
      re: /(?:A[NÑ]O\s*(?:DE\s*)?)?(?:REG(?:ISTRO)?|EMISI[OÓ0]N)/i,
    },
    { field: "vigencia", re: /V[I1]GENC[I1]A/i },
  ];

  for (const { field, re } of patterns) {
    const match = line.match(re);
    if (match?.index != null) labels.push({ field, index: match.index });
  }

  return labels.sort((a, b) => a.index - b.index);
}

function numericTokens(line: string): string[] {
  return Array.from(line.matchAll(/\b\d{3,4}\b/g)).map((match) => match[0]);
}

function footerValueTokens(line: string): string[] {
  return Array.from(
    line.matchAll(/\b(?:20\d{2}\s*[-–]\s*20\d{2}|\d{3,4})\b/g),
  ).map((match) => match[0]);
}

function assignFooterCandidate(
  out: Partial<Record<IneFooterField, { value: string; confidence: number }>>,
  field: IneFooterField,
  value: string,
  confidence: number,
): void {
  if (out[field] || !isValidFooterValue(field, value)) return;
  out[field] = { value, confidence };
}

function extractIneFooterFields(
  lines: string[],
  combined: string,
): Partial<Record<IneFooterField, { value: string; confidence: number }>> {
  const out: Partial<
    Record<IneFooterField, { value: string; confidence: number }>
  > = {};

  const secMatch = combined.match(SECCION_RE);
  if (secMatch) assignFooterCandidate(out, "seccion", secMatch[1], 1.0);

  const regMatch = combined.match(REGISTRO_RE);
  if (regMatch) assignFooterCandidate(out, "registro", regMatch[1], 1.0);

  const vigMatch = combined.match(VIGENCIA_RE);
  if (vigMatch) {
    const bestVigencia = extractBestVigenciaYear(vigMatch[1]);
    if (bestVigencia) {
      assignFooterCandidate(out, "vigencia", bestVigencia, 1.0);
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const labels = detectFooterLabels(line);
    if (labels.length === 0) continue;

    const sameLineValues = footerValueTokens(line);
    if (sameLineValues.length >= labels.length) {
      labels.forEach((label, idx) => {
        if (label.field === "vigencia") {
          const bestVigencia = extractBestVigenciaYear(sameLineValues[idx]);
          if (bestVigencia) {
            assignFooterCandidate(out, label.field, bestVigencia, 0.92);
          }
          return;
        }
        assignFooterCandidate(out, label.field, sameLineValues[idx], 0.92);
      });
    }

    const nextWindow = lines.slice(i + 1, Math.min(i + 3, lines.length));
    for (const nextLine of nextWindow) {
      if (detectFooterLabels(nextLine).length > 0) break;
      const belowValues = footerValueTokens(nextLine);
      if (belowValues.length < labels.length) continue;
      labels.forEach((label, idx) => {
        const value = belowValues[idx];
        if (label.field === "vigencia") {
          const bestVigencia = extractBestVigenciaYear(value);
          if (bestVigencia) {
            assignFooterCandidate(out, label.field, bestVigencia, 0.86);
          }
          return;
        }
        assignFooterCandidate(out, label.field, value, 0.86);
      });
      break;
    }

    for (const label of labels) {
      if (out[label.field]) continue;
      const after = line.slice(label.index);
      const candidate =
        label.field === "vigencia"
          ? extractBestVigenciaYear(after)
          : numericTokens(after).find((value) =>
              isValidFooterValue(label.field, value),
            );
      if (candidate) assignFooterCandidate(out, label.field, candidate, 0.82);
    }
  }

  return out;
}

/**
 * Tokens que indican inicio de línea-etiqueta (no son valores de campo).
 * Usados para detener la recolección multi-línea del domicilio.
 */
const LABEL_TOKENS = [
  /^CLAVE/i,
  /^CURP/i,
  /^ESTADO/i,
  /^MUNICIPIO/i,
  /^LOCALIDAD/i,
  /^SECCI[OÓ]N/i,
  /^VIGENCIA/i,
  /^FECHA/i,
  /^SEXO/i,
  /^INE/i,
  /^IFE/i,
  /^INSTITUTO/i,
  /^D[O0]M[I1]C[I1]L[I1][O0]/i, // DOMICILIO (OCR tolerante)
  // Campos de domicilio que actúan como separadores entre secciones del reverso
  /^COLONIA/i,
  /^COL\./i,
  /^C[OÓ]DIGO/i, // CODIGO POSTAL
  /^C\.P\./i,
  /^NOMBRE/i, // previene que líneas "NOMBRE" de otra sección se incluyan en domicilio
  /^APELLIDO/i,
  /^PATERNO/i, // etiqueta parcial sola
  /^MATERNO/i, // etiqueta parcial sola
];

// ── Regex de extracción (Decisión §6 + §3) ────────────────────────────────────

/**
 * CURP: formato oficial es 18 caracteres.
 * Posiciones 0-3: consonantes del nombre (letras)
 * Posiciones 4-9: fecha de nacimiento YYMMDD (dígitos)
 * Posición 10: sexo H/M (letra)
 * Posiciones 11-13: abreviatura de estado nacimiento (letras)
 * Posiciones 14-17: consonantes internas + homoclave (alfanumérico)
 *
 * Usamos character class ampliado para capturar errores OCR comunes
 * [A-Z0-9] y luego sanear con fixCurpOcr().
 */
const CURP_LOOSE_RE =
  /\b[A-Z]{1,4}[A-Z0-9]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HMhm01][A-Z]{5,6}[A-Z0-9]{1,3}\b/;

/**
 * Clave de Elector: 18 caracteres.
 * 6 letras + 8 dígitos + H/M + 3 dígitos
 * También capturamos variante loose para corrección post-match.
 */
const CLAVE_ELECTOR_LOOSE_RE = /\b[A-Z0-9]{6}\d{8}[HM01][0-9]{3}\b/;

/** Sección electoral: etiqueta + 4 dígitos */
const SECCION_RE = /SECCI[OÓ0]N\s*[:\-]?\s*(\d{3,4})/i;

/** Año de registro/emisión: suele estar junto a sección/vigencia. */
const REGISTRO_RE =
  /(?:A[NÑ]O\s*(?:DE\s*)?)?(?:REG(?:ISTRO)?|EMISI[OÓ0]N)\s*[:\-]?\s*((?:19|20)\d{2})/i;

/** Vigencia: año único o rango YYYY-YYYY después de la etiqueta */
const VIGENCIA_RE =
  /V[I1]GENC[I1]A\s*[:\-]?\s*((?:20)\d{2}(?:\s*[-–]\s*(?:20)\d{2})?)/i;

/** Fecha DD/MM/YYYY */
const FECHA_SLASH_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;

/** Fecha "DD ENE 1990" — meses en español abreviados (Decisión §9) */
const MESES: Record<string, string> = {
  ENE: "01",
  FEB: "02",
  MAR: "03",
  ABR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AGO: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DIC: "12",
};
const FECHA_MES_RE =
  /\b(\d{2})\s+(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{4})\b/i;

/** Fecha sin separadores DDMMYYYY */
const FECHA_CONCAT_RE = /\b(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(\d{4})\b/;

const FECHA_NAC_LABEL_RE =
  /(?:FECHA\s+(?:DE\s+)?NAC(?:IMIENTO)?|NACIMIENTO|FEC(?:HA)?\s*NAC)/i;

/** Sexo: etiqueta + H o M */
const SEXO_RE = /\bSEXO\s*[:\-]?\s*([HM])\b/i;

// ── Normalización de texto (Decisión §2) ──────────────────────────────────────

/**
 * Normaliza el texto OCR crudo antes de extraer campos.
 * Pasos:
 *  a) Convertir a mayúsculas (INE es todo caps; la normalización hace los
 *     regex más simples y evita falsos negativos por casing mixto).
 *  b) Reemplazar caracteres especiales comunes de marca de agua / borde
 *     de tarjeta (◆ ● ■ » * | ~) por espacio.
 *  c) Colapsar espacios múltiples en uno solo dentro de cada línea.
 *  d) Eliminar líneas cortas (< 2 chars) que son ruido de borde.
 *  e) Eliminar líneas que son solo dígitos < 2 chars (bordes de frame).
 */
export function normalizeOcrText(raw: string): string {
  return (
    raw
      // a) Composición Unicode NFC: normaliza combinaciones de carácter + diacrítico
      //    a su forma precompuesta. Esto asegura que Á, É, Í, Ó, Ú, Ñ queden como
      //    un solo codepoint antes de cualquier otra transformación.
      //    Ejemplo: A + U+0301 (combining acute) → Á; N + U+0303 → Ñ
      .normalize("NFC")
      .toUpperCase()
      // b) ANTES de eliminar la virgulilla (~), reconstruir la Ñ que ML Kit
      //    puede haber separado en dos caracteres: "MUN~OZ" → "MUÑOZ".
      //    (NFC ya maneja la mayoría, esto captura las variantes ASCII.)
      .replace(/N[˜~]/g, "Ñ")
      .replace(/[˜~]N/g, "Ñ")
      // c.1) Diacríticos no españoles generados por ruido OCR en hologramas.
      //      El español solo usa tildes agudas (Á É Í Ó Ú) y Ñ; cualquier
      //      umlaut/grave/circumflejo es error OCR — lo mapeamos a su base.
      .replace(/[ÄÀÂ]/g, "A")
      .replace(/[ÖÒÔØ]/g, "O")
      .replace(/[ÜÙÛ]/g, "U")
      .replace(/[ÈÊ]/g, "E")
      .replace(/[ÌÎ]/g, "I")
      // c) Reemplazar símbolos de marca de agua / bordes (ahora que ~ ya fue manejada)
      .replace(/[◆●■»*|~#@%^&]/g, " ")
      // d) Colapsar whitespace interno
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      // e) Eliminar ruido (líneas muy cortas que no son valor de campo)
      .filter((line) => line.length >= 2)
      // f) Filtrar líneas MRZ (Machine-Readable Zone: contienen <)
      //    que aparecen en el reverso de algunos modelos y confunden
      //    el regex de CURP con cadenas similares de 18 chars.
      .filter((line) => !line.includes("<"))
      // g) Unir fragmentos de línea cortados por OCR cerca de hologramas.
      //    Condición: ambas líneas son < 5 chars de pura letra (sin dígitos, sin espacios)
      //    y ninguna es una etiqueta de campo o abreviatura conocida.
      //    Ejemplo: ["GARCIA HER", "NANDEZ"] → no aplica (HER tiene 3 chars pero NANDEZ tiene 6)
      //    Ejemplo: ["RODR", "IGUEZ"] → ["RODRIGUEZ"]  (ambas < 6 chars, solo letras)
      .reduce((acc: string[], line) => {
        const prev = acc[acc.length - 1];
        if (
          prev !== undefined &&
          prev.length <= 5 &&
          line.length <= 5 &&
          /^[A-ZÁÉÍÓÚÑÜ]+$/.test(prev) &&
          /^[A-ZÁÉÍÓÚÑÜ]+$/.test(line)
        ) {
          acc[acc.length - 1] = prev + line;
        } else {
          acc.push(line);
        }
        return acc;
      }, [])
      .join("\n")
  );
}

// ── Corrección de caracteres OCR en campos con formato fijo (Decisión §3) ─────

/**
 * Corrige confusiones OCR en una cadena candidata a CURP.
 * La CURP tiene posiciones con formato determinístico:
 *   [0-3] letra  [4-9] dígito  [10] H/M  [11-13] letra  [14-17] alfanumerico
 * Aplicamos la corrección según si la posición "debería" ser letra o dígito.
 */
export function fixCurpOcr(raw: string): string {
  if (raw.length !== 18) return raw;
  const chars = raw.split("");

  // Posiciones que deben ser letras (0-3, 10-13)
  const letterPositions = [0, 1, 2, 3, 10, 11, 12, 13];
  // Posiciones que deben ser dígitos (4-9)
  const digitPositions = [4, 5, 6, 7, 8, 9];
  // Posiciones 14-17: alfanumérico — no corregir

  for (const pos of letterPositions) {
    const ch = chars[pos];
    if (OCR_DIGIT_TO_LETTER[ch]) chars[pos] = OCR_DIGIT_TO_LETTER[ch];
  }
  for (const pos of digitPositions) {
    const ch = chars[pos];
    if (OCR_LETTER_TO_DIGIT[ch]) chars[pos] = OCR_LETTER_TO_DIGIT[ch];
  }
  return chars.join("");
}

/**
 * Corrige confusiones OCR en una cadena candidata a Clave de Elector.
 * Formato: LLLLLL-DDDDDDDD-S-DDD  (L=letra, D=dígito, S=sexo H/M)
 * Pos 0-5: letras, 6-13: dígitos, 14: H/M (letra), 15-17: dígitos.
 */
export function fixClaveElectorOcr(raw: string): string {
  if (raw.length !== 18) return raw;
  const chars = raw.split("");
  const letterPositions = [0, 1, 2, 3, 4, 5, 14];
  const digitPositions = [6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17];

  for (const pos of letterPositions) {
    const ch = chars[pos];
    if (OCR_DIGIT_TO_LETTER[ch]) chars[pos] = OCR_DIGIT_TO_LETTER[ch];
  }
  for (const pos of digitPositions) {
    const ch = chars[pos];
    if (OCR_LETTER_TO_DIGIT[ch]) chars[pos] = OCR_LETTER_TO_DIGIT[ch];
  }
  return chars.join("");
}

/**
 * Verifica el dígito de control (posíción 17) de una CURP.
 *
 * Algoritmo RENAPO:
 *   1. Cada caracter en posiciones 0–16 se mapea a su índice en CURP_VERIFY_CHARS.
 *   2. Se multiplica por el peso (18 − i).
 *   3. La suma módulo 10 da el residuo; el dígito esperado = (10 − residuo) % 10.
 *   4. Debe coincidir con parseInt(curp[17], 10).
 *
 * Retorna false si el último carácter no es un dígito (algunos CURPs emitidos
 * antes de la normalización de 1994 usan letra en posición 17 — se omite la
 * verificación en ese caso para no rechazarlos.
 */
const CURP_VERIFY_CHARS = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
export function verifyCurpCheckDigit(curp: string): boolean {
  if (curp.length !== 18) return false;
  const lastDigit = parseInt(curp[17], 10);
  // Si el último caracter es letra, la CURP pre-verificación — no rechazar.
  if (isNaN(lastDigit)) return true;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const idx = CURP_VERIFY_CHARS.indexOf(curp[i]);
    if (idx < 0) return false; // carácter desconocido
    sum += idx * (18 - i);
  }
  return (10 - (sum % 10)) % 10 === lastDigit;
}

// ── Extracción de fecha con múltiples formatos (Decisión §9) ──────────────────

/**
 * Intenta extraer una fecha del texto y la normaliza a DD/MM/YYYY.
 * Prueba los tres formatos en orden de confianza.
 * Retorna null si no encuentra nada válido.
 */
export function extractFecha(
  text: string,
): { value: string; confidence: number } | null {
  // 1. Formato DD/MM/YYYY (más común y directo)
  const slashMatch = text.match(FECHA_SLASH_RE);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    if (isValidDate(dd, mm, yyyy)) {
      return { value: `${dd}/${mm}/${yyyy}`, confidence: 1.0 };
    }
  }

  // 2. Formato "05 ENE 1990" con mes abreviado en español
  const mesMatch = text.match(FECHA_MES_RE);
  if (mesMatch) {
    const [, dd, mesAbr, yyyy] = mesMatch;
    const mm = MESES[mesAbr.toUpperCase()];
    if (mm && isValidDate(dd, mm, yyyy)) {
      return { value: `${dd}/${mm}/${yyyy}`, confidence: 0.95 };
    }
  }

  // 3. Fecha pegada sin separadores DDMMYYYY
  const concatMatch = text.match(FECHA_CONCAT_RE);
  if (concatMatch) {
    const [, dd, mm, yyyy] = concatMatch;
    if (isValidDate(dd, mm, yyyy)) {
      return { value: `${dd}/${mm}/${yyyy}`, confidence: 0.6 };
    }
  }

  return null;
}

function extractFechaNacimiento(
  lines: string[],
  combined: string,
): { value: string; confidence: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (!FECHA_NAC_LABEL_RE.test(lines[i])) continue;
    const windowText = lines.slice(i, Math.min(i + 4, lines.length)).join("\n");
    const contextual = extractFecha(windowText);
    if (contextual) {
      return {
        value: contextual.value,
        confidence: Math.min(contextual.confidence + 0.05, 1),
      };
    }
  }

  const candidates: { value: string; confidence: number; score: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const parsed = extractFecha(lines[i]);
    if (!parsed) continue;
    const nearby = lines
      .slice(Math.max(0, i - 1), Math.min(lines.length, i + 2))
      .join(" ");
    let score = parsed.confidence;
    if (FECHA_NAC_LABEL_RE.test(nearby)) score += 0.2;
    if (/REGISTRO|EMISI[OÓ]N|VIGENCIA/i.test(nearby)) score -= 0.35;
    candidates.push({ ...parsed, score });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return {
      value: candidates[0].value,
      confidence: Math.max(0.45, Math.min(candidates[0].score, 0.95)),
    };
  }

  return extractFecha(combined);
}

function isValidDate(dd: string, mm: string, yyyy: string): boolean {
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (d < 1 || m < 1 || m > 12 || y < 1900 || y > 2100) return false;
  // Días por mes — índice 1-based; Feb = 28 base (se ajusta para bisiestos)
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) daysInMonth[2] = 29;
  return d <= daysInMonth[m];
}

// ── Detección de modelo de INE (Decisión §6) ──────────────────────────────────

/**
 * Detecta la versión aproximada de la credencial a partir de tokens
 * característicos en el texto OCR normalizado.
 *
 * Heurísticas usadas:
 * - "INSTITUTO FEDERAL ELECTORAL" → IFE (modelos A o B)
 * - "INSTITUTO NACIONAL ELECTORAL" → INE (modelos C o D)
 * - Presencia de "MODELO D" o "MODELO F" explícito en el texto → Modelo D
 * - Presencia de QR (no detectable por texto) — se ignora
 * - Año de vigencia ≥ 2024 sugiere modelo D (INE 2019+)
 */
export function detectIneModelo(normalizedText: string): IneModelo {
  if (/INSTITUTO\s+FEDERAL\s+ELECTORAL/.test(normalizedText)) {
    // B_IFE2013 se distribuyó entre 2011 y 2017 con vigencias 2014–2021.
    // Si la vigencia es ≥ 2014 asumimos Modelo B (QR visible, layout ligeramente distinto).
    const vigenciaIfeMtch = normalizedText.match(VIGENCIA_RE);
    const vigenciaIfeYear = vigenciaIfeMtch
      ? extractBestVigenciaYear(vigenciaIfeMtch[1])
      : null;
    if (vigenciaIfeYear && parseInt(vigenciaIfeYear, 10) >= 2014) {
      return "B_IFE2013";
    }
    return "A_IFE2008";
  }
  if (/INSTITUTO\s+NACIONAL\s+ELECTORAL/.test(normalizedText)) {
    const vigenciaMatch = normalizedText.match(VIGENCIA_RE);
    const vigenciaYear = vigenciaMatch
      ? extractBestVigenciaYear(vigenciaMatch[1])
      : null;
    if (vigenciaYear && parseInt(vigenciaYear, 10) >= 2024) {
      return "D_INE2019";
    }
    return "C_INE2015";
  }
  return "unknown";
}

// ── Extracción de nombres (Decisión §7) ───────────────────────────────────────

interface NameResult {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  method:
    | "mrz"
    | "spatial"
    | "labels"
    | "fuzzy_labels"
    | "block"
    | "curp_initials"
    | "none";
}

function splitFullName(full: string): {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
} {
  const clean = cleanNameValue(full);
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    // Formato mexicano estándar: PATERNO MATERNO NOMBRE(S)
    return {
      apellidoPaterno: parts[0],
      apellidoMaterno: parts[1],
      nombre: parts.slice(2).join(" "),
    };
  }
  if (parts.length === 2) {
    return {
      apellidoPaterno: parts[0],
      apellidoMaterno: "",
      nombre: parts[1],
    };
  }
  // 1 sola palabra: más probable que sea apellido paterno que nombre
  return {
    apellidoPaterno: clean,
    apellidoMaterno: "",
    nombre: "",
  };
}

/**
 * Estrategia A – Etiquetas explícitas
 * Busca líneas "APELLIDO PATERNO", "APELLIDO MATERNO", "NOMBRE(S)" y toma
 * la línea siguiente que no sea otra etiqueta.
 * Es la más confiable cuando ML Kit preserva el orden de bloques.
 *
 * LAYOUT REAL DE LA INE:
 *   La etiqueta stand-alone "NOMBRE" encabeza un bloque de 3 renglones:
 *     +1 → APELLIDO PATERNO
 *     +2 → APELLIDO MATERNO
 *     +3 → NOMBRE(S)
 *
 * Mejoras:
 *  - Tolera variantes OCR de etiquetas: "APELL1DO", "APELLID0", "AP. PATERNO"
 *  - Busca en líneas i+1 e i+2 (ML Kit inserta líneas en blanco a veces)
 *  - Maneja formato "PATERNO: GARCIA" con dos puntos
 */
/** Patrón OCR-tolerante para "APELLIDO" */
const APELLIDO_RE = /A(?:PELLID|PELL[I1]D)[O0]/i;
/** Patrón OCR-tolerante para "PATERNO" */
const PATERNO_RE = /PATERN[O0]/i;
/** Patrón OCR-tolerante para "MATERNO" */
const MATERNO_RE = /MATERN[O0]/i;
/** Patrón OCR-tolerante para "NOMBRE" */
const NOMBRE_RE = /N[O0]MBRE(?:\([S5]\))?/i;

function extractNamesFromLabels(lines: string[]): NameResult | null {
  const result = { nombre: "", apellidoPaterno: "", apellidoMaterno: "" };
  let found = false;

  // Helper: obtener siguiente valor no-etiqueta (salta líneas vacías/cortas)
  const getNextValue = (idx: number): string | null => {
    for (let j = idx + 1; j < Math.min(idx + 4, lines.length); j++) {
      const candidate = lines[j];
      if (!candidate || candidate.length < 2) continue;
      if (isLabel(candidate)) return null;
      // Filtrar líneas que son solo dígitos (números de página, sección)
      if (/^\d+$/.test(candidate)) continue;
      return candidate;
    }
    return null;
  };

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];

    // ── APELLIDO PATERNO ──────────────────────────────────────────────────
    // Tolera: "APELLIDO PATERNO", "APELL1DO PATERN0", "AP PATERNO",
    //         "AP. PATERNO", solo "PATERNO" (sin "APELLIDO")
    const isApPaternoLabel =
      new RegExp(`^${APELLIDO_RE.source}\\s+${PATERNO_RE.source}$`, "i").test(
        line,
      ) ||
      /^AP\.?\s+PATERN[O0]$/i.test(line) ||
      new RegExp(`^${PATERNO_RE.source}$`, "i").test(line);

    if (isApPaternoLabel && !result.apellidoPaterno) {
      const next = getNextValue(i);
      if (next) {
        result.apellidoPaterno = cleanNameValue(next);
        found = true;
      }
    }

    // ── APELLIDO MATERNO ──────────────────────────────────────────────────
    const isApMaternoLabel =
      new RegExp(`^${APELLIDO_RE.source}\\s+${MATERNO_RE.source}$`, "i").test(
        line,
      ) ||
      /^AP\.?\s+MATERN[O0]$/i.test(line) ||
      new RegExp(`^${MATERNO_RE.source}$`, "i").test(line);

    if (isApMaternoLabel && !result.apellidoMaterno) {
      const next = getNextValue(i);
      if (next) {
        result.apellidoMaterno = cleanNameValue(next);
        found = true;
      }
    }

    // ── NOMBRE – cabecera del bloque de nombre completo (INE estándar) ────
    // En la INE real "NOMBRE" es una etiqueta standalone que encabeza
    // exactamente 3 renglones en orden fijo:
    //   +1 → APELLIDO PATERNO
    //   +2 → APELLIDO MATERNO
    //   +3 → NOMBRE(S)
    if (new RegExp(`^${NOMBRE_RE.source}$`, "i").test(line)) {
      const nameLines: string[] = [];
      for (
        let j = i + 1;
        j < Math.min(i + 7, lines.length) && nameLines.length < 3;
        j++
      ) {
        const candidate = lines[j];
        if (!candidate || candidate.length < 2) continue;
        if (isLabel(candidate)) break;
        if (/^\d+$/.test(candidate)) continue;
        nameLines.push(candidate);
      }
      if (nameLines.length >= 1 && !result.apellidoPaterno) {
        result.apellidoPaterno = cleanNameValue(nameLines[0]);
        found = true;
      }
      if (nameLines.length >= 2 && !result.apellidoMaterno) {
        result.apellidoMaterno = cleanNameValue(nameLines[1]);
        found = true;
      }
      if (nameLines.length >= 3 && !result.nombre) {
        result.nombre = cleanNameValue(nameLines.slice(2).join(" "));
        found = true;
      }
      continue; // ya procesamos el bloque, no continuar con inline-checks
    }

    // ── Etiqueta y valor en la misma línea ────────────────────────────────
    // "APELLIDO PATERNO GARCIA" o "PATERNO GARCIA"
    const inlineAP =
      line.match(
        new RegExp(
          `^${APELLIDO_RE.source}\\s+${PATERNO_RE.source}\\s+(.+)$`,
          "i",
        ),
      ) ||
      line.match(/^AP\.?\s+PATERN[O0]\s+(.+)$/i) ||
      line.match(new RegExp(`^${PATERNO_RE.source}\\s+(.+)$`, "i"));
    if (inlineAP && !result.apellidoPaterno) {
      result.apellidoPaterno = cleanNameValue(inlineAP[1]);
      found = true;
    }

    const inlineAM =
      line.match(
        new RegExp(
          `^${APELLIDO_RE.source}\\s+${MATERNO_RE.source}\\s+(.+)$`,
          "i",
        ),
      ) ||
      line.match(/^AP\.?\s+MATERN[O0]\s+(.+)$/i) ||
      line.match(new RegExp(`^${MATERNO_RE.source}\\s+(.+)$`, "i"));
    if (inlineAM && !result.apellidoMaterno) {
      result.apellidoMaterno = cleanNameValue(inlineAM[1]);
      found = true;
    }

    // "NOMBRE(S) JUAN PEREZ" o "NOMBRE JUAN"
    const inlineNombre = line.match(
      new RegExp(`^${NOMBRE_RE.source}\\s+(.+)$`, "i"),
    );
    if (inlineNombre && !result.nombre) {
      result.nombre = cleanNameValue(inlineNombre[1]);
      found = true;
    }

    // Formato con dos puntos: "PATERNO: GARCIA"
    const colonAP = line.match(/PATERN[O0]\s*:\s*(.+)$/i);
    if (colonAP && !result.apellidoPaterno) {
      result.apellidoPaterno = cleanNameValue(colonAP[1]);
      found = true;
    }
    const colonAM = line.match(/MATERN[O0]\s*:\s*(.+)$/i);
    if (colonAM && !result.apellidoMaterno) {
      result.apellidoMaterno = cleanNameValue(colonAM[1]);
      found = true;
    }
    const colonNombre = line.match(
      new RegExp(`${NOMBRE_RE.source}\\s*:\\s*(.+)$`, "i"),
    );
    if (colonNombre && !result.nombre) {
      result.nombre = cleanNameValue(colonNombre[1]);
      found = true;
    }
  }

  // Fallback: si solo tenemos un "nombre" completo (sin apellidos), ocurre
  // cuando ninguna etiqueta estructural fue encontrada pero una línea inline
  // como "NOMBRE(S) GARCIA LOPEZ JUAN" dejó todo en result.nombre.
  // En ese caso splitear con el orden estándar mexicano.
  if (result.nombre && !result.apellidoPaterno && !result.apellidoMaterno) {
    const split = splitFullName(result.nombre);
    result.apellidoPaterno = split.apellidoPaterno;
    result.apellidoMaterno = split.apellidoMaterno;
    result.nombre = split.nombre;
  }

  return found ? { ...result, method: "labels" } : null;
}

/**
 * Estrategia B – Bloque de nombre antes del CURP
 * En muchas versiones de INE el bloque nombre/apellidos aparece como 3 líneas
 * seguidas (AP PATERNO, AP MATERNO, NOMBRE) justo antes de la fecha o CURP.
 *
 * Mejoras:
 *  - Múltiples anclas: CURP (10 chars), CURP (6 chars), "FECHA DE NAC",
 *    "SEXO", "CLAVE DE ELECTOR" — aumenta chance de encontrar ancla
 *  - Más tolerante con líneas que tengan 1-2 dígitos (OCR confunde letras)
 *  - No rompe en la primera línea no-candidata; salta si len < 2
 */
function extractNamesFromBlock(
  lines: string[],
  curp: string,
): NameResult | null {
  // Ancla primaria: línea que contiene los primeros 10 chars del CURP
  let anchorIdx =
    curp && curp.length >= 10
      ? lines.findIndex((l) => l.includes(curp.substring(0, 10)))
      : -1;

  // Ancla con 6 chars de CURP (más tolerante con OCR parcial)
  if (anchorIdx < 2 && curp && curp.length >= 6) {
    anchorIdx = lines.findIndex((l) => l.includes(curp.substring(0, 6)));
  }

  // Ancla en "FECHA DE NACIMIENTO"
  if (anchorIdx < 2) {
    const fechaIdx = lines.findIndex((l) => /FECHA\s+DE\s+NAC/i.test(l));
    if (fechaIdx >= 2) anchorIdx = fechaIdx;
  }

  // Ancla en "SEXO" (está justo después de los nombres en modelos C/D)
  if (anchorIdx < 2) {
    const sexoIdx = lines.findIndex((l) => /^SEXO/i.test(l));
    if (sexoIdx >= 2) anchorIdx = sexoIdx;
  }

  // Ancla en "CLAVE DE ELECTOR" o "CLAVE" (debajo de nombres en el reverso)
  if (anchorIdx < 2) {
    const claveIdx = lines.findIndex((l) => /^CLAVE/i.test(l));
    if (claveIdx >= 2) anchorIdx = claveIdx;
  }

  if (anchorIdx < 1) return null;

  // Buscar candidatos de nombre HACIA ATRÁS desde el ancla
  const candidates: string[] = [];
  let skippedNonMatch = 0;
  for (let i = anchorIdx - 1; i >= Math.max(0, anchorIdx - 7); i--) {
    const l = lines[i];
    if (l.length < 2) continue; // Ignorar líneas vacías/cortas
    // Líneas de nombre: mayúsculas + espacios + tildes, tolerando 1-2 dígitos
    // por errores OCR (ej: "GARC1A" en vez de "GARCIA")
    const cleaned = l.replace(/[0-9]/g, "");
    if (/^[A-ZÁÉÍÓÚÑÜ\s]{3,}$/.test(cleaned) && !isLabel(l) && l.length >= 3) {
      candidates.unshift(l.trim());
      skippedNonMatch = 0;
      // INE nunca tiene más de 3 líneas de nombre (paterno / materno / nombre(s))
      if (candidates.length >= 3) break;
    } else {
      skippedNonMatch++;
      // Tolerar hasta 2 líneas de ruido intercaladas (ML Kit a veces inserta
      // líneas sueltas entre los bloques de nombre)
      if (skippedNonMatch >= 2) break;
    }
  }

  // También buscar HACIA ADELANTE (ML Kit puede desordenar los bloques)
  if (candidates.length < 2) {
    for (
      let i = anchorIdx + 1;
      i < Math.min(anchorIdx + 6, lines.length);
      i++
    ) {
      const l = lines[i];
      if (l.length < 2) continue;
      if (isDomicilioStop(l)) break;
      const cleaned = l.replace(/[0-9]/g, "");
      if (
        /^[A-ZÁÉÍÓÚÑÜ\s]{3,}$/.test(cleaned) &&
        !isLabel(l) &&
        l.length >= 3
      ) {
        candidates.push(l.trim());
      }
    }
  }

  // Las INE más comunes ordenan: APELLIDO PATERNO / APELLIDO MATERNO / NOMBRE(S)
  if (candidates.length >= 3) {
    return {
      apellidoPaterno: cleanNameValue(candidates[0]),
      apellidoMaterno: cleanNameValue(candidates[1]),
      nombre: cleanNameValue(candidates.slice(2).join(" ")),
      method: "block",
    };
  }
  if (candidates.length === 2) {
    return {
      apellidoPaterno: cleanNameValue(candidates[0]),
      apellidoMaterno: cleanNameValue(candidates[1]),
      nombre: "",
      method: "block",
    };
  }
  // Si solo encontramos 1 candidato, intentar splitearlo (nombre completo en 1 línea)
  if (candidates.length === 1) {
    const split = splitFullName(candidates[0]);
    // splitFullName con 1 palabra ahora devuelve apellidoPaterno
    // con 2+ palabras puede devolver paterno + nombre
    if (split.apellidoPaterno) {
      // Si tenemos CURP, verificar que las iniciales coincidan
      if (curp && curp.length >= 4) {
        const firstChar = split.apellidoPaterno[0];
        if (firstChar === curp[0]) {
          return { ...split, method: "block" };
        }
        // Si la inicial no coincide con pos 0 del CURP (ap. paterno),
        // podría ser el nombre (pos 3) o ap. materno (pos 2)
        if (firstChar === curp[3]) {
          return {
            nombre: split.apellidoPaterno,
            apellidoPaterno: "",
            apellidoMaterno: "",
            method: "block",
          };
        }
      }
      return { ...split, method: "block" };
    }
  }
  return null;
}

/**
 * Estrategia C – Iniciales desde CURP (fallback)
 * CURP posición 0: primer consonante interna ap. paterno
 * CURP posición 1: primera vocal ap. paterno
 * CURP posición 2: primer consonante interna ap. materno
 * CURP posición 3: primera consonante interna del nombre
 * Solo devuelve iniciales — útil para mostrar algo cuando el texto es ilegible.
 */
function extractNamesFromCurp(curp: string): NameResult {
  if (curp.length < 4) {
    return {
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      method: "none",
    };
  }
  return {
    apellidoPaterno: curp[0] + curp[1] + "...",
    apellidoMaterno: curp[2] + "...",
    nombre: curp[3] + "...",
    method: "curp_initials",
  };
}

// ── Extracción de domicilio (Decisión §8) ─────────────────────────────────────

/** Tokens que detienen la recolección de líneas de domicilio */
const DOMICILIO_STOP_TOKENS = [
  /^CLAVE/i,
  /^CURP/i,
  /^SECCI[OÓ]N/i,
  /^VIGENCIA/i,
  /^FECHA/i,
  /^SEXO/i,
  /^INE/i,
  /^IFE/i,
  /^INSTITUTO/i,
  /^NOMBRE/i,
  /^APELLIDO/i,
  /^EMISI[OÓ]N/i,
  /^A[NÑ]O\s+DE/i,
  /^CREDENCIAL/i,
  // Líneas de MRZ (tres <'s o más)
  /<<<+/,
];

function isDomicilioStop(line: string): boolean {
  return DOMICILIO_STOP_TOKENS.some((re) => re.test(line));
}

// ── Estrategia §11: keywords fuzzy ───────────────────────────────────────────

/**
 * Distancia de Levenshtein (edición mínima) — O(m*n) tiempo, O(n) espacio.
 * Usada para detectar keywords INE con errores OCR típicos, p.ej.:
 *   "N0MBRE" → "NOMBRE"  (dist 1)
 *   "APELIDO" → "APELLIDO" (dist 1)
 *   "PATERN0" → "PATERNO"  (dist 1)
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, k) => k);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Campos del resultado fuzzy (unión de todos los campos INE extraíbles).
 */
type FuzzyFields = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  sexo: string;
  seccion: string;
  registro: string;
  vigencia: string;
  claveElector: string;
  domicilio: string;
  fechaNacimiento: string;
};

/**
 * Definición de cada keyword INE con límites de extracción por campo.
 *
 * maxWords: número máximo de palabras que constituyen el VALOR del campo.
 *   NOMBRE puede ser 4 o más palabras ("JUAN CARLOS MIGUEL ANGEL").
 *   APELLIDO PATERNO/MATERNO a lo más 2 palabras ("GARCIA HERNANDEZ").
 *   CURP, SEXO, SECCIÓN, VIGENCIA: 1 valor compacto.
 *
 * multiLine: si el valor puede extenderse a más de una línea (domicilio).
 *
 * isNameBlock: si true, la etiqueta encabeza un bloque de 3 renglones:
 *   +1 → APELLIDO PATERNO, +2 → APELLIDO MATERNO, +3 → NOMBRE(S).
 *   Se usa para la etiqueta stand-alone "NOMBRE" de la INE real.
 */
interface FkDef {
  keyword: string;
  field: keyof FuzzyFields;
  maxWords: number;
  multiLine: boolean;
  isNameBlock?: boolean;
}

const FUZZY_FIELD_KEYWORDS: FkDef[] = [
  // “NOMBRE” standalone → encabeza el bloque paterno/materno/nombre
  {
    keyword: "NOMBRE",
    field: "nombre",
    maxWords: 3,
    multiLine: false,
    isNameBlock: true,
  },
  {
    keyword: "APELLIDO PATERNO",
    field: "apellidoPaterno",
    maxWords: 2,
    multiLine: false,
  },
  {
    keyword: "APELLIDO MATERNO",
    field: "apellidoMaterno",
    maxWords: 2,
    multiLine: false,
  },
  {
    keyword: "PATERNO",
    field: "apellidoPaterno",
    maxWords: 2,
    multiLine: false,
  },
  {
    keyword: "MATERNO",
    field: "apellidoMaterno",
    maxWords: 2,
    multiLine: false,
  },
  { keyword: "CURP", field: "curp", maxWords: 1, multiLine: false },
  { keyword: "SEXO", field: "sexo", maxWords: 1, multiLine: false },
  { keyword: "SECCION", field: "seccion", maxWords: 1, multiLine: false },
  { keyword: "REGISTRO", field: "registro", maxWords: 1, multiLine: false },
  { keyword: "ANO REGISTRO", field: "registro", maxWords: 1, multiLine: false },
  { keyword: "AÑO REGISTRO", field: "registro", maxWords: 1, multiLine: false },
  { keyword: "EMISION", field: "registro", maxWords: 1, multiLine: false },
  { keyword: "VIGENCIA", field: "vigencia", maxWords: 1, multiLine: false },
  {
    keyword: "CLAVE ELECTOR",
    field: "claveElector",
    maxWords: 1,
    multiLine: false,
  },
  { keyword: "DOMICILIO", field: "domicilio", maxWords: 20, multiLine: true },
  {
    keyword: "FECHA NACIMIENTO",
    field: "fechaNacimiento",
    maxWords: 3,
    multiLine: false,
  },
];

/**
 * Nombres oficiales de los 32 estados de la República Mexicana.
 * Usados para detectar la línea terminal del domicilio.
 * El domicilio en INE siempre termina con el nombre del estado.
 * Se incluyen variantes con y sin tildes, abreviaturas comunes y
 * lecturas OCR frecuentes (e.g. "VERACRUZ DE IGNACIO…" → "VERACRUZ").
 */
const MEXICAN_STATES_RE = new RegExp(
  "^(?:" +
    [
      "AGUASCALIENTES",
      "BAJA CALIFORNIA SUR",
      "BAJA CALIFORNIA",
      "CAMPECHE",
      "CHIAPAS",
      "CHIHUAHUA",
      "CIUDAD DE M[EÉ]XICO",
      "CDMX",
      "C\\.?D\\.?M\\.?X\\.?",
      "COAHUILA(?: DE ZARAGOZA)?",
      "COLIMA",
      "DISTRITO FEDERAL",
      "D\\.?F\\.?",
      "DURANGO",
      "GUANAJUATO",
      "GUERRERO",
      "HIDALGO",
      "JALISCO",
      "M[EÉ]XICO", // also matches Estado de México
      "ESTADO DE M[EÉ]XICO",
      "MICHOAC[AÁ]N(?: DE OCAMPO)?",
      "MORELOS",
      "NAYARIT",
      "NUEVO LE[OÓ]N",
      "OAXACA",
      "PUEBLA",
      "QUER[EÉ]TARO(?: DE ARTEAGA)?",
      "QUINTANA ROO",
      "SAN LUIS POTOS[IÍ]",
      "SINALOA",
      "SONORA",
      "TABASCO",
      "TAMAULIPAS",
      "TLAXCALA",
      "VERACRUZ(?: DE IGNACIO DE LA LLAVE)?",
      "YUCAT[AÁ]N",
      "ZACATECAS",
    ].join("|") +
    ")\\b",
  "i",
);

/** Retorna true si la línea es (o comienza con) el nombre de un estado mexicano. */
function isMexicanState(line: string): boolean {
  return MEXICAN_STATES_RE.test(line.trim());
}

/**
 * Intenta hacer match fuzzy entre una línea y los keywords INE conocidos.
 *
 * Algoritmo:
 *   1. Para keywords de 1 palabra: comparar cada palabra de la línea contra
 *      el keyword usando Levenshtein. Umbral: similitud ≥ 0.72 y dist ≤ 3.
 *      Esto permite hasta ~2 errores OCR en palabras de 7 caracteres.
 *   2. Para keywords multi-palabra: comparar bigramas/trigramas consecutivos
 *      de la línea. Umbral: similitud ≥ 0.72 y dist ≤ 4.
 *   3. Match exacto recibe score 1.0; match fuzzy recibe score × 0.85.
 *
 * Retorna el mejor match o null si ninguno supera el umbral.
 * `inlineValue` contiene las palabras que vienen DESPUÉS del keyword en
 * la misma línea (formato inline: "NOMBRE JUAN CARLOS" → inlineValue = "JUAN CARLOS").
 */
function fuzzyMatchKeyword(line: string): {
  fk: FkDef;
  score: number;
  inlineValue: string;
} | null {
  const upper = line.toUpperCase().trim();
  const lineWords = upper.split(/\s+/).filter(Boolean);

  let best: { fk: FkDef; score: number; kwWordCount: number } | null = null;

  for (const fk of FUZZY_FIELD_KEYWORDS) {
    const kwWords = fk.keyword.split(" ");
    const kwLen = kwWords.length;

    if (kwLen === 1) {
      for (const word of lineWords) {
        if (word.length < 3) continue;
        const dist = levenshtein(word, fk.keyword);
        const maxL = Math.max(word.length, fk.keyword.length);
        const sim = 1 - dist / maxL;
        if (sim >= 0.72 && dist <= 3) {
          const score = word === fk.keyword ? 1.0 : sim * 0.85;
          if (!best || score > best.score) best = { fk, score, kwWordCount: 1 };
        }
      }
    } else {
      for (let i = 0; i <= lineWords.length - kwLen; i++) {
        const ngram = lineWords.slice(i, i + kwLen).join(" ");
        const dist = levenshtein(ngram, fk.keyword);
        const maxL = Math.max(ngram.length, fk.keyword.length);
        const sim = 1 - dist / maxL;
        if (sim >= 0.72 && dist <= 4) {
          const score = ngram === fk.keyword ? 1.0 : sim * 0.8;
          if (!best || score > best.score)
            best = { fk, score, kwWordCount: kwLen };
        }
      }
    }
  }

  if (!best) return null;

  // Compute inline value: words in the SAME line after the matched keyword.
  // Find where the keyword ends in lineWords by scanning for the fuzzy match.
  const kwWords = best.fk.keyword.split(" ");
  let matchStart = -1;
  for (let i = 0; i <= lineWords.length - kwWords.length; i++) {
    const ngram = lineWords.slice(i, i + kwWords.length).join(" ");
    if (levenshtein(ngram, best.fk.keyword) <= 3) {
      matchStart = i;
      break;
    }
  }

  const afterWords =
    matchStart >= 0 ? lineWords.slice(matchStart + kwWords.length) : [];

  const inlineValue = afterWords.slice(0, best.fk.maxWords).join(" ");

  return { fk: best.fk, score: best.score, inlineValue };
}

/**
 * Estrategia §11 — Extracción guiada por keywords fuzzy.
 *
 * Para cada línea del OCR:
 *   1. Calcular qué keyword es el más similar (fuzzy).
 *   2. Marcar esa línea como "no dato" (es una etiqueta).
 *   3. Si hay palabras inline después del keyword, usarlas como valor.
 *   4. Si no, buscar en las 3 líneas siguientes, respetando:
 *      - maxWords: límite de palabras por campo
 *      - isLabel/fuzzyMatchKeyword: detener al llegar a otra etiqueta
 *      - multiLine: acumular líneas para domicilio
 *
 * Retorna nameResult (para integrar en nameStrategies) y extras
 * (CURP, sexo, etc. que pueden llenar huecos del parse principal).
 */
function extractFromFuzzyAnchors(lines: string[]): {
  nameResult: NameResult;
  extras: Partial<FuzzyFields>;
} {
  const extracted: Partial<FuzzyFields> = {};

  for (let i = 0; i < lines.length; i++) {
    const match = fuzzyMatchKeyword(lines[i]);
    if (!match) continue;

    const { fk, inlineValue } = match;
    const field = fk.field;

    // Skip: field already extracted by a previous anchor
    if (extracted[field]) continue;

    // ── NOMBRE como cabecera de bloque de 3 renglones ───────────────────────────
    // La etiqueta "NOMBRE" en la INE introduce 3 renglones en orden fijo:
    //   siguiente línea válida [0] → apellidoPaterno
    //   siguiente línea válida [1] → apellidoMaterno
    //   siguiente línea válida [2] → nombre(s)
    if (fk.isNameBlock && !inlineValue) {
      const nameLines: string[] = [];
      for (
        let j = i + 1;
        j < Math.min(i + 7, lines.length) && nameLines.length < 3;
        j++
      ) {
        const candidate = lines[j].trim();
        if (!candidate || candidate.length < 2) continue;
        if (fuzzyMatchKeyword(candidate)) break;
        if (isLabel(candidate)) break;
        nameLines.push(candidate);
      }
      if (nameLines.length >= 1 && !extracted.apellidoPaterno)
        extracted.apellidoPaterno = nameLines[0];
      if (nameLines.length >= 2 && !extracted.apellidoMaterno)
        extracted.apellidoMaterno = nameLines[1];
      if (nameLines.length >= 3 && !extracted.nombre)
        extracted.nombre = nameLines.slice(2).join(" ");
      continue;
    }

    // Case A — inline value: keyword and data on the same line
    // e.g. "NOMBRE JUAN CARLOS" → inlineValue = "JUAN CARLOS"
    if (inlineValue.length >= 2) {
      extracted[field] = inlineValue;
      continue;
    }

    // Case B — value in subsequent lines (label is on its own line)
    // INVARIANT: los valores SIEMPRE están DEBAJO del marcador (j > i).
    // Nunca se escanean líneas anteriores al anchor actual.
    const valueChunks: string[] = [];
    let wordsCollected = 0;

    // Use a wider window for multiLine fields (domicilio can span many lines);
    // single-line fields break early via the wordsCollected >= maxWords guard.
    const windowEnd = Math.min(i + (fk.multiLine ? 10 : 6), lines.length);

    for (let j = i + 1; j < windowEnd; j++) {
      const candidate = lines[j].trim();
      if (!candidate || candidate.length < 2) continue;

      // Stop if we hit another fuzzy keyword / label line
      if (fuzzyMatchKeyword(candidate)) break;
      if (isLabel(candidate)) break;

      const words = candidate.split(/\s+/).filter(Boolean);

      if (!fk.multiLine) {
        // Single-line value: collect up to maxWords
        const take = words.slice(0, fk.maxWords - wordsCollected);
        if (take.length > 0) {
          valueChunks.push(take.join(" "));
          wordsCollected += take.length;
        }
        if (wordsCollected >= fk.maxWords) break;
      } else {
        // Multi-line value (domicilio): acumular hacia abajo.
        // Hard-stop tokens (header labels): no incluir, terminar.
        if (isDomicilioStop(candidate)) break;
        // Siempre incluir la línea actual.
        valueChunks.push(candidate);
        // Si es un estado mexicano, es la línea terminal → incluir y terminar.
        if (isMexicanState(candidate)) break;
        // Safety cap: máximo 8 líneas de domicilio
        if (valueChunks.length >= 8) break;
      }
    }

    if (valueChunks.length > 0) {
      extracted[field] = (
        fk.multiLine ? valueChunks.join(", ") : valueChunks.join(" ")
      ).trim();
    }
  }

  const nombre = cleanNameValue(extracted.nombre ?? "");
  const apellidoPaterno = cleanNameValue(extracted.apellidoPaterno ?? "");
  const apellidoMaterno = cleanNameValue(extracted.apellidoMaterno ?? "");

  const nameResult: NameResult = {
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    method:
      nombre || apellidoPaterno || apellidoMaterno ? "fuzzy_labels" : "none",
  };

  return { nameResult, extras: extracted };
}

function isLabel(line: string): boolean {
  return LABEL_TOKENS.some((re) => re.test(line));
}

/** Elimina artefactos OCR comunes del valor de un nombre */
function cleanNameValue(s: string): string {
  return s
    .replace(/[^A-ZÁÉÍÓÚÑÜ\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Selección inteligente de nombres (reemplaza cascada ??) ───────────────────

interface NameFieldConfidences {
  nombre: number;
  apellidoPaterno: number;
  apellidoMaterno: number;
}

interface MergedNameResult extends NameResult {
  fieldConfidences: NameFieldConfidences;
}

/**
 * Selecciona el mejor candidato por campo de nombre entre TODAS las estrategias.
 *
 * En vez de la cascada anterior (spatial ?? labels ?? block ?? curp_initials)
 * que tomaba el primer resultado no-null completo, esta función:
 *
 *   1. Recopila candidatos no-vacíos de cada estrategia para cada campo
 *   2. Puntúa cada candidato: confianza base × match diccionario × match CURP
 *   3. Elige el mejor candidato por campo independientemente
 *
 * Esto permite mezclar resultados de estrategias diferentes:
 *   - Spatial encontró apellidoPaterno pero no nombre
 *   - Labels encontró nombre
 *   → El merge devuelve ambos
 */
function selectBestNames(
  strategies: { result: NameResult | null; baseConf: number }[],
  curp: string,
): MergedNameResult {
  interface Candidate {
    value: string;
    method: NameResult["method"];
    baseConf: number;
  }

  const patCandidates: Candidate[] = [];
  const matCandidates: Candidate[] = [];
  const nomCandidates: Candidate[] = [];

  for (const { result, baseConf } of strategies) {
    if (!result) continue;
    if (result.apellidoPaterno.length >= 2) {
      patCandidates.push({
        value: result.apellidoPaterno,
        method: result.method,
        baseConf,
      });
    }
    if (result.apellidoMaterno.length >= 2) {
      matCandidates.push({
        value: result.apellidoMaterno,
        method: result.method,
        baseConf,
      });
    }
    if (result.nombre.length >= 2) {
      nomCandidates.push({
        value: result.nombre,
        method: result.method,
        baseConf,
      });
    }
  }

  const scoreCandidate = (
    c: Candidate,
    field: "paterno" | "materno" | "nombre",
  ): number => {
    let score = c.baseConf;

    // Bonus por coincidencia en diccionario
    const dictScore =
      field === "nombre" ? scoreAsNombre(c.value) : scoreAsApellido(c.value);
    score += dictScore * 0.2;

    // Bonus por coincidencia con CURP
    if (curp.length >= 4) {
      const cleanVal = c.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "");
      if (cleanVal.length > 0) {
        if (field === "paterno" && cleanVal[0] === curp[0]) score += 0.15;
        if (field === "materno" && cleanVal[0] === curp[2]) score += 0.15;
        if (field === "nombre" && cleanVal[0] === curp[3]) score += 0.15;
      }
    }

    // Penalización por valores muy cortos (sospechosos de ser iniciales)
    if (c.value.length <= 3 && c.method !== "curp_initials") score -= 0.2;
    // Penalización extra para curp_initials (siempre es fallback)
    if (c.method === "curp_initials") score -= 0.3;

    return score;
  };

  const pickBest = (
    candidates: Candidate[],
    field: "paterno" | "materno" | "nombre",
  ): {
    value: string;
    method: NameResult["method"];
    confidence: number;
  } | null => {
    if (candidates.length === 0) return null;

    // ── Consensus grouping ────────────────────────────────────────────────
    // Cuando dos o más estrategias independientes extraen el mismo valor para
    // un campo, ese acuerdo es evidencia de correctitud adicional al score
    // individual. Aplicamos un bonus +0.10 por cada estrategia adicional que
    // coincide, con un máximo de +0.30 (4 estrategias de acuerdo).
    //
    // Normalización: uppercase + solo caracteres alfabéticos para ignorar
    // diferencias de tildes o puntuación entre extracciones.
    const norm = (s: string) => s.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "");

    // Agrupar candidatos por valor normalizado
    const groups = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const key = norm(c.value);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    let bestValue = candidates[0].value;
    let bestMethod = candidates[0].method;
    let bestFinalScore = -Infinity;

    for (const [, group] of groups) {
      // Representante del grupo: el candidato de mayor confianza base
      const rep = group.reduce((a, b) => (a.baseConf >= b.baseConf ? a : b));
      const individual = scoreCandidate(rep, field);
      // Bonus de consenso: +0.10 por estrategia adicional que coincide
      const consensusBonus = Math.min((group.length - 1) * 0.1, 0.3);
      const finalScore = individual + consensusBonus;

      if (finalScore > bestFinalScore) {
        bestFinalScore = finalScore;
        bestValue = rep.value;
        bestMethod = rep.method;
      }
    }

    // Confianza reportada: base + bonus de consenso, capped a 1.0
    const winnerGroup = groups.get(norm(bestValue)) ?? [candidates[0]];
    const maxBaseConf = winnerGroup.reduce(
      (acc, c) => Math.max(acc, c.baseConf),
      0,
    );
    const winnerBonus = Math.min((winnerGroup.length - 1) * 0.1, 0.3);

    return {
      value: bestValue,
      method: bestMethod,
      confidence: Math.min(maxBaseConf + winnerBonus, 1.0),
    };
  };

  const bestPat = pickBest(patCandidates, "paterno");
  const bestMat = pickBest(matCandidates, "materno");
  const bestNom = pickBest(nomCandidates, "nombre");

  // Determinar el método primario (la estrategia que contribuyó más campos)
  const methods = [bestPat?.method, bestMat?.method, bestNom?.method].filter(
    Boolean,
  ) as NameResult["method"][];
  const methodCounts = new Map<string, number>();
  for (const m of methods) {
    methodCounts.set(m, (methodCounts.get(m) ?? 0) + 1);
  }
  const primaryMethod =
    ([...methodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as
      | NameResult["method"]
      | undefined) ?? "none";

  // ── Rescue: nombre contiene apellidos (todo vino en un campo) ────────────
  // Ocurre cuando el OCR no encontró etiquetas independientes y puso la línea
  // completa "GARCIA LOPEZ JUAN" en el campo nombre. Si no tenemos apellido
  // paterno pero el nombre tiene ≥2 palabras, intentamos separarlo usando el
  // orden estándar mexicano: PATERNO MATERNO NOMBRE(S).
  // Verificamos contra la inicial del CURP para evitar inversiones erróneas.
  if (!bestPat && bestNom) {
    const words = bestNom.value.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const split = splitFullName(bestNom.value);
      if (split.apellidoPaterno.length >= 2) {
        const firstLetter = split.apellidoPaterno
          .toUpperCase()
          .replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "")[0];
        const curpOk =
          !curp || curp.length < 1 || !firstLetter || firstLetter === curp[0];
        if (curpOk) {
          const derivedConf = Math.min((bestNom.confidence ?? 0.5) * 0.8, 0.75);
          return {
            apellidoPaterno: split.apellidoPaterno,
            apellidoMaterno: split.apellidoMaterno,
            nombre: split.nombre,
            method: primaryMethod,
            fieldConfidences: {
              apellidoPaterno: derivedConf,
              apellidoMaterno:
                split.apellidoMaterno.length >= 2 ? derivedConf * 0.9 : 0,
              nombre: split.nombre.length >= 1 ? derivedConf * 0.85 : 0,
            },
          };
        }
      }
    }
  }

  return {
    apellidoPaterno: bestPat?.value ?? "",
    apellidoMaterno: bestMat?.value ?? "",
    nombre: bestNom?.value ?? "",
    method: primaryMethod,
    fieldConfidences: {
      apellidoPaterno: bestPat?.confidence ?? 0,
      apellidoMaterno: bestMat?.confidence ?? 0,
      nombre: bestNom?.confidence ?? 0,
    },
  };
}

// ── Cálculo de confianza global (Decisión §5) ─────────────────────────────────

type FieldConf = Record<
  keyof Omit<
    IneOcrResult,
    | "confidence"
    | "fieldConfidence"
    | "modeloDetected"
    | "domicilioDesglosado"
    | "fieldSources"
    | "correctionsApplied"
  >,
  number
>;

/**
 * Pesos relativos por campo.
 * CURP y Clave de Elector son validables con regex estricto → peso mayor.
 * Domicilio y Sección son secundarios para identificación → peso menor.
 */
const FIELD_WEIGHTS: Partial<Record<keyof FieldConf, number>> = {
  curp: 2.0,
  claveElector: 1.5,
  ocrNumber: 0.4,
  cic: 0.5,
  nombre: 1.5,
  apellidoPaterno: 1.2,
  apellidoMaterno: 1.0,
  fechaNacimiento: 1.2,
  sexo: 0.8,
  seccion: 0.6,
  registro: 0.5,
  vigencia: 0.6,
  domicilio: 0.8,
};

function computeOverallConfidence(
  fields: FieldConf,
  results: Omit<
    IneOcrResult,
    | "confidence"
    | "fieldConfidence"
    | "modeloDetected"
    | "domicilioDesglosado"
    | "fieldSources"
    | "correctionsApplied"
  >,
): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const k of Object.keys(fields)) {
    const key = k as keyof FieldConf;
    const weight = FIELD_WEIGHTS[key] ?? 1.0;
    const hasValue = String((results as any)[key]).length > 0;
    totalWeight += weight;
    if (hasValue) weightedScore += fields[key] * weight;
  }

  return totalWeight > 0 ? Math.min(weightedScore / totalWeight, 1) : 0;
}

function estimateOcrDimensions(blocks: OcrBlock[]): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;
  for (const block of blocks) {
    if (!block.frame) continue;
    maxX = Math.max(maxX, block.frame.x + block.frame.width);
    maxY = Math.max(maxY, block.frame.y + block.frame.height);
  }
  return {
    width: maxX > 0 ? maxX : 4032,
    height: maxY > 0 ? maxY : 3024,
  };
}

function sourceRegionFromBlocks(
  blocks: OcrBlock[] | undefined,
  side: "front" | "back",
  method: string,
  dimensionBlocks?: OcrBlock[],
): IneOcrSourceRegion | undefined {
  const framed = (blocks ?? []).filter((block) => block.frame);
  if (framed.length === 0) return undefined;

  const dims = estimateOcrDimensions(
    dimensionBlocks && dimensionBlocks.length > 0 ? dimensionBlocks : framed,
  );
  const minX = Math.min(...framed.map((block) => block.frame!.x));
  const minY = Math.min(...framed.map((block) => block.frame!.y));
  const maxX = Math.max(
    ...framed.map((block) => block.frame!.x + block.frame!.width),
  );
  const maxY = Math.max(
    ...framed.map((block) => block.frame!.y + block.frame!.height),
  );
  const padX = dims.width * 0.035;
  const padY = dims.height * 0.03;

  const x = Math.max((minX - padX) / dims.width, 0);
  const y = Math.max((minY - padY) / dims.height, 0);
  const right = Math.min((maxX + padX) / dims.width, 1);
  const bottom = Math.min((maxY + padY) / dims.height, 1);

  return {
    side,
    x,
    y,
    width: Math.max(right - x, 0.08),
    height: Math.max(bottom - y, 0.06),
    text: framed.map((block) => block.text).join("\n"),
    method,
  };
}

function blockTextIncludes(block: OcrBlock, needle: string): boolean {
  const cleanNeedle = needle.toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑÜ]/g, "");
  if (cleanNeedle.length < 2) return false;
  const cleanBlock = [block.text, ...block.lines.map((line) => line.text)]
    .join(" ")
    .toUpperCase()
    .replace(/[^A-Z0-9ÁÉÍÓÚÑÜ]/g, "");
  return cleanBlock.includes(cleanNeedle);
}

function findFieldSource(
  frontBlocks: OcrBlock[] | undefined,
  backBlocks: OcrBlock[] | undefined,
  field: IneTextField,
  value: string,
): IneOcrSourceRegion | undefined {
  if (!value) return undefined;
  const searchValues = [value];
  if (field === "fechaNacimiento") searchValues.push(value.replace(/\//g, ""));

  for (const side of ["front", "back"] as const) {
    const blocks = side === "front" ? frontBlocks : backBlocks;
    const match = blocks?.filter((block) =>
      searchValues.some((candidate) => blockTextIncludes(block, candidate)),
    );
    const region = sourceRegionFromBlocks(
      match,
      side,
      `${field}_value`,
      blocks,
    );
    if (region) return { ...region, confidence: 0.9 };
  }

  return undefined;
}

function buildOcrFieldSources(params: {
  res: Record<IneTextField, string>;
  frontBlocks?: OcrBlock[];
  backBlocks?: OcrBlock[];
  frontAddressBlocks?: OcrBlock[];
}): Partial<Record<IneTextField, IneOcrSourceRegion>> {
  const { res, frontBlocks, backBlocks, frontAddressBlocks } = params;
  const sources: Partial<Record<IneTextField, IneOcrSourceRegion>> = {};

  const domicilioSource = sourceRegionFromBlocks(
    frontAddressBlocks,
    "front",
    "domicilio_spatial",
    frontBlocks,
  );
  if (domicilioSource) {
    sources.domicilio = { ...domicilioSource, confidence: 0.85 };
  }

  for (const field of Object.keys(res) as IneTextField[]) {
    if (field === "domicilio") continue;
    const source = findFieldSource(frontBlocks, backBlocks, field, res[field]);
    if (source) sources[field] = source;
  }

  return sources;
}

// ── Función principal (Decisión §2) ───────────────────────────────────────────

/**
 * Extrae campos INE del texto OCR normalizado.
 *
 * @param frontText   Texto crudo del anverso (puede ser null si no se capturó aún)
 * @param backText    Texto crudo del reverso
 * @param modeloHint  Modelo de credencial seleccionado por el brigadista (Decisión §10).
 *                    Cuando se provee y la auto-detección falla, se usa este valor.
 * @param frontBlocks Bloques OCR con coordenadas espaciales del anverso
 * @param backBlocks  Bloques OCR con coordenadas espaciales del reverso
 * @returns IneOcrResult con todos los campos y confianzas
 */
export function parseIneOcrText(
  frontText: string | null,
  backText: string | null,
  modeloHint?: IneModelo,
  frontBlocks?: OcrBlock[],
  backBlocks?: OcrBlock[],
  corrections?: FieldCorrections,
): IneOcrResult {
  // Paso 0: Extraer MRZ del texto CRUDO (antes de normalizar)
  // normalizeOcrText() filtra líneas con < que son esenciales para el MRZ.
  const mrzData = parseMrz(backText, frontText);
  const mrzNames: NameResult | null =
    mrzData && (mrzData.apellidoPaterno || mrzData.nombre)
      ? {
          apellidoPaterno: mrzData.apellidoPaterno,
          apellidoMaterno: mrzData.apellidoMaterno,
          nombre: mrzData.nombre,
          method: "mrz" as const,
        }
      : null;

  // Paso 1: Normalizar ambos textos
  const front = normalizeOcrText(frontText ?? "");
  const back = normalizeOcrText(backText ?? "");
  const combined = [front, back].filter(Boolean).join("\n");
  const ocrNumberResult = extractOcrNumber(back);
  // CIC se extrae del texto CRUDO (antes de normalizar) porque contiene `<`
  const cicResult = extractCic(backText);

  // Paso 2: Dividir en líneas para estrategias de contexto
  const lines = combined
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);

  // Paso 3: Inicializar confianzas por campo (Decisión §5)
  const fc: FieldConf = {
    curp: 0,
    claveElector: 0,
    ocrNumber: 0,
    cic: 0,
    nombre: 0,
    apellidoPaterno: 0,
    apellidoMaterno: 0,
    fechaNacimiento: 0,
    sexo: 0,
    seccion: 0,
    registro: 0,
    vigencia: 0,
    domicilio: 0,
  };

  const res = {
    curp: "",
    claveElector: "",
    ocrNumber: "",
    cic: "",
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    sexo: "",
    seccion: "",
    registro: "",
    vigencia: "",
    domicilio: "",
  };
  const frontClassified = frontBlocks ? classifyFrontBlocks(frontBlocks) : null;

  // ── Campo: CURP ──────────────────────────────────────────────────────────
  // CURP está en el reverso (todos los modelos) y en el anverso (modelo C/D).
  // Probamos combined primero; si hay múltiples matches tomamos el de 18 chars.
  {
    const candidates = [
      ...combined.matchAll(new RegExp(CURP_LOOSE_RE.source, "g")),
    ]
      .map((m) => m[0])
      .filter((c) => c.length >= 17 && c.length <= 19);

    const best =
      candidates.map(fixCurpOcr).find((c) => c.length === 18) ?? null;

    if (best) {
      res.curp = best;
      // Validar con regex estricto post-corrección
      const strictOk = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]{2}$/.test(best);
      const checksumOk = verifyCurpCheckDigit(best);
      fc.curp = strictOk && checksumOk ? 1.0 : strictOk ? 0.85 : 0.75;
    }
  }

  // ── Campo: Clave de Elector ──────────────────────────────────────────────
  {
    const candidates = [
      ...combined.matchAll(new RegExp(CLAVE_ELECTOR_LOOSE_RE.source, "g")),
    ]
      .map((m) => m[0])
      .filter((c) => c.length === 18);

    const best = candidates.map(fixClaveElectorOcr)[0] ?? null;
    if (best) {
      res.claveElector = best;
      fc.claveElector = /^[A-Z]{6}\d{8}[HM]\d{3}$/.test(best) ? 1.0 : 0.7;
    }
  }

  // Cross-validar Clave de Elector vs CURP.
  // El primer caracter de Clave de Elector debe coincidir con CURP[0]
  // (ambos codifican la inicial del apellido paterno).
  // Una discrepancia sugiere error OCR en uno de los dos campos.
  if (res.claveElector.length === 18 && res.curp.length === 18) {
    if (res.claveElector[0] !== res.curp[0]) {
      fc.claveElector = Math.max(fc.claveElector - 0.15, 0.4);
    }
  }

  // ── Campo: OCR del reverso ──────────────────────────────────────────────
  if (ocrNumberResult) {
    res.ocrNumber = ocrNumberResult.value;
    fc.ocrNumber = ocrNumberResult.confidence;
  }

  // ── Campo: CIC (Clave de Identificación de Credencial) ──────────────────
  // Extraído del texto crudo del reverso: 13+ dígitos tras marcador `<<`.
  if (cicResult) {
    res.cic = cicResult.value;
    fc.cic = cicResult.confidence;
  }

  // ── Campo: Fecha de nacimiento ───────────────────────────────────────────
  {
    const fechaResult = extractFechaNacimiento(lines, combined);
    if (fechaResult) {
      res.fechaNacimiento = fechaResult.value;
      fc.fechaNacimiento = fechaResult.confidence;
    }
  }
  // Fallback: derivar fecha desde CURP si el OCR no encontró una fecha.
  // CURP posiciones 4-5=YY, 6-7=MM, 8-9=DD.
  // Lógica de siglo dinámica para padrón electoral (edad mínima 18 años):
  //   Calculamos el año de corte dinámicamente: (añoActual - 18) % 100
  //   Si YY <= corte → 2000+YY (persona de 18+ años nacida en 200x)
  //   Si YY > corte  → 1900+YY (persona nacida en 19xx)
  if (!res.fechaNacimiento && res.curp.length === 18) {
    const yy = parseInt(res.curp.substring(4, 6), 10);
    const mm = res.curp.substring(6, 8);
    const dd = res.curp.substring(8, 10);
    const currentYear = new Date().getFullYear();
    const cutoff = (currentYear - 18) % 100;
    const year = yy <= cutoff ? 2000 + yy : 1900 + yy;
    // Sólo usar si los valores son plausibles
    if (isValidDate(dd, mm, String(year))) {
      res.fechaNacimiento = `${dd}/${mm}/${year}`;
      fc.fechaNacimiento = 0.8; // Derivado de CURP — confiable pero no literal
    }
  }
  // ── Campo: Sexo ──────────────────────────────────────────────────────────
  {
    const sexoMatch = combined.match(SEXO_RE);
    if (sexoMatch) {
      res.sexo = sexoMatch[1].toUpperCase();
      fc.sexo = 1.0;
    } else if (res.curp.length === 18) {
      // Derivar desde CURP posición 10 (Decisión §7 — misma lógica aplica aquí)
      const sexoCurp = res.curp[10];
      if (sexoCurp === "H" || sexoCurp === "M") {
        res.sexo = sexoCurp;
        fc.sexo = 0.85; // Derivado de CURP, no de etiqueta directa
      }
    }
  }

  // ── Enriquecimiento desde MRZ ────────────────────────────────────────────
  // Si el MRZ proporcionó fecha o sexo y el OCR principal no, usarlos.
  if (mrzData) {
    if (!res.fechaNacimiento && mrzData.fechaNacimiento) {
      res.fechaNacimiento = mrzData.fechaNacimiento;
      fc.fechaNacimiento = mrzData.confidence * 0.9;
    }
    if (!res.sexo && mrzData.sexo) {
      res.sexo = mrzData.sexo;
      fc.sexo = mrzData.confidence * 0.85;
    }
  }

  // Cross-validar fecha OCR vs fecha codificada en el CURP.
  // El CURP codifica la fecha de forma determinista (posiciones 4–9: YYMMDD).
  // Si el OCR de texto libre extrajo una fecha diferente, el CURP gana:
  // es más resistente a errores de segmentación de línea.
  if (res.fechaNacimiento && res.curp.length === 18) {
    const yyCurp = parseInt(res.curp.substring(4, 6), 10);
    const mmCurp = res.curp.substring(6, 8);
    const ddCurp = res.curp.substring(8, 10);
    const currentYear = new Date().getFullYear();
    const cutoff = (currentYear - 18) % 100;
    const yearCurp = yyCurp <= cutoff ? 2000 + yyCurp : 1900 + yyCurp;
    if (isValidDate(ddCurp, mmCurp, String(yearCurp))) {
      const curpDerivedDate = `${ddCurp}/${mmCurp}/${yearCurp}`;
      if (res.fechaNacimiento !== curpDerivedDate) {
        res.fechaNacimiento = curpDerivedDate;
        // Confianza ligeramente reducida: el año de siglo es inferido, no literal
        fc.fechaNacimiento = Math.min(fc.curp * 0.9, 0.85);
      }
    }
  }

  // ── Campos variables de pie: Sección / registro / vigencia ──────────────
  // En credenciales INE estos valores pueden aparecer a la derecha del label
  // o debajo de una fila de labels. Se extraen por orden visual de etiquetas.
  {
    const footer = extractIneFooterFields(lines, combined);
    if (footer.seccion) {
      res.seccion = footer.seccion.value;
      fc.seccion = footer.seccion.confidence;
    }
    if (footer.registro) {
      res.registro = footer.registro.value;
      fc.registro = footer.registro.confidence;
    }
    if (footer.vigencia) {
      res.vigencia = footer.vigencia.value;
      fc.vigencia = footer.vigencia.confidence;
    }
  }

  // ── Campos: Nombres ──────────────────────────────────────────────────────
  // Estrategia mejorada: en vez de cascada con ?? (donde la primera
  // estrategia no-null bloquea las demás), ejecutamos TODAS las estrategias
  // y seleccionamos el mejor candidato por campo individual.
  //
  // Esto permite que si spatial encuentra apellidoPaterno pero no nombre,
  // y labels encuentra nombre pero no apellidoPaterno, los combine.
  //
  // Prioridad base: mrz > spatial > labels > fuzzy_labels > block > curp_initials
  // Estrategia §11: fuzzy keyword — ejecutar primero para tener los extras
  // disponibles para rellenar campos que las otras estrategias no encontraron.
  const fuzzyResult = extractFromFuzzyAnchors(lines);

  const nameStrategies: { result: NameResult | null; baseConf: number }[] = [
    {
      result: mrzNames,
      baseConf: mrzNames ? mrzData!.confidence : 0,
    },
    {
      result: frontClassified
        ? extractNamesFromSpatial(frontClassified.nameBlocks)
        : null,
      baseConf: 0.95,
    },
    {
      result: extractNamesFromLabels(lines),
      baseConf: 0.9,
    },
    // Estrategia §11: keywords fuzzy (entre labels y block)
    // Captura etiquetas con errores OCR (N0MBRE, APELIDO, PATERN0…)
    // y extrae el valor respetando maxWords por campo.
    {
      result: fuzzyResult.nameResult,
      baseConf: 0.82,
    },
    {
      result: extractNamesFromBlock(lines, res.curp),
      baseConf: 0.7,
    },
    {
      result: res.curp ? extractNamesFromCurp(res.curp) : null,
      baseConf: 0.3,
    },
  ];

  // ── Merge: mejor candidato por campo ────────────────────────────────────
  const merged = selectBestNames(nameStrategies, res.curp);

  // Aplicar corrección OCR y diccionario a nombres
  res.nombre = correctNameFromDictionary(fixNameOcr(merged.nombre));
  res.apellidoPaterno = correctNameFromDictionary(
    fixNameOcr(merged.apellidoPaterno),
  );
  res.apellidoMaterno = correctNameFromDictionary(
    fixNameOcr(merged.apellidoMaterno),
  );

  // ── Cross-validación CURP ↔ Nombres ──────────────────────────────────────
  // Verificar que los campos nombre/apellidos coinciden con posiciones del CURP.
  // Si no coinciden, intentar intercambiar campos.
  if (res.curp.length === 18 && (res.nombre || res.apellidoPaterno)) {
    const curpMatch = matchCurpInitials(
      res.curp,
      res.nombre,
      res.apellidoPaterno,
      res.apellidoMaterno,
    );

    if (curpMatch.score < 0.5) {
      // Intentar TODAS las permutaciones posibles de los 3 campos
      const fields = [res.nombre, res.apellidoPaterno, res.apellidoMaterno];
      const permutations: [string, string, string][] = [
        [fields[1], fields[0], fields[2]], // swap nombre ↔ paterno
        [fields[2], fields[1], fields[0]], // swap nombre ↔ materno
        [fields[0], fields[2], fields[1]], // swap paterno ↔ materno
        [fields[1], fields[2], fields[0]], // rotación: p→n, m→p, n→m
        [fields[2], fields[0], fields[1]], // rotación: m→n, n→p, p→m
      ];

      let bestScore = curpMatch.score;
      let bestPerm: [string, string, string] | null = null;

      for (const [n, p, m] of permutations) {
        const s = matchCurpInitials(res.curp, n, p, m);
        if (s.score > bestScore) {
          bestScore = s.score;
          bestPerm = [n, p, m];
        }
      }

      if (bestPerm) {
        [res.nombre, res.apellidoPaterno, res.apellidoMaterno] = bestPerm;
      }
    }

    // Usar diccionario para desambiguar nombre vs apellido si el score sigue bajo
    if (!res.nombre && res.apellidoPaterno) {
      // Si apellidoPaterno parece más nombre que apellido, moverlo
      const nomScore = scoreAsNombre(res.apellidoPaterno);
      const apeScore = scoreAsApellido(res.apellidoPaterno);
      if (nomScore > apeScore && nomScore > 0.3) {
        res.nombre = res.apellidoPaterno;
        res.apellidoPaterno = "";
      }
    }
  }

  // Confianza por campo: calculada del merge (qué estrategia contribuyó)
  fc.nombre = res.nombre ? merged.fieldConfidences.nombre : 0;
  fc.apellidoPaterno = res.apellidoPaterno
    ? merged.fieldConfidences.apellidoPaterno
    : 0;
  fc.apellidoMaterno = res.apellidoMaterno
    ? merged.fieldConfidences.apellidoMaterno
    : 0;

  // ── Relleno de campos con extras fuzzy (§11) ─────────────────────────────
  // Si la extracción principal no encontró un campo, los extras que la
  // estrategia fuzzy derivó desde sus anclas cubren el hueco.
  // Se aplica con confianza reducida (~0.65-0.70) porque el fuzzy puede
  // capturar texto adyacente que no sea el valor correcto.
  {
    const ext = fuzzyResult.extras;

    if (!res.curp && ext.curp) {
      const fixed = fixCurpOcr(ext.curp.replace(/\s+/g, ""));
      if (fixed.length === 18) {
        res.curp = fixed;
        fc.curp = 0.6;
      }
    }

    if (!res.sexo && ext.sexo) {
      // Eliminar cualquier caracter que no sea H o M antes de comparar.
      // Cubre errores OCR como "H.", "H1", "M." o "H M" (espacio extra).
      const s = ext.sexo
        .replace(/[^HhMm]/g, "")
        .charAt(0)
        .toUpperCase();
      if (s === "H" || s === "M") {
        res.sexo = s;
        fc.sexo = 0.7;
      }
    }

    if (!res.seccion && ext.seccion) {
      const sec = ext.seccion.match(/\d{3,4}/)?.[0];
      if (sec && validSeccion(sec)) {
        res.seccion = sec;
        fc.seccion = 0.7;
      }
    }

    if (!res.registro && ext.registro) {
      const reg = ext.registro.match(/\d{4}/)?.[0];
      if (reg && validRegistro(reg)) {
        res.registro = reg;
        fc.registro = 0.7;
      }
    }

    if (!res.vigencia && ext.vigencia) {
      const vig = ext.vigencia.match(/\d{4}/)?.[0];
      if (vig && validVigencia(vig)) {
        res.vigencia = vig;
        fc.vigencia = 0.7;
      }
    }

    if (!res.fechaNacimiento && ext.fechaNacimiento) {
      const fr = extractFecha(ext.fechaNacimiento);
      if (fr) {
        res.fechaNacimiento = fr.value;
        fc.fechaNacimiento = fr.confidence * 0.75;
      }
    }
  }

  // ── Campo: Domicilio ─────────────────────────────────────────────────────
  // El domicilio está en el FRENTE de la INE, entre los nombres y los datos
  // de identificación (CURP, CLAVE, SECCIÓN). Ver layout en ine-spatial.ts.
  //
  // Cascada multi-estrategia:
  //   1. Espacial del FRENTE (zona de dirección)
  //   2. Texto del FRENTE (busca anclas DOMICILIO, COL., C.P.)
  //   3. Espacial del REVERSO (fallback para modelos IFE antiguos)
  //   4. Texto del REVERSO (fallback)
  {
    // ─── 1. Extracción espacial del FRENTE ──────────────────────────────
    const frontSpatialAddr = frontClassified?.addressBlocks?.length
      ? extractAddressFromSpatialExpert(frontClassified.addressBlocks)
      : null;

    // ─── 2. Extracción textual del FRENTE ───────────────────────────────
    const frontLines = front
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 2);
    const frontTextAddr = extractDomicilioExpert(frontLines);

    // ─── 3. Extracción espacial del REVERSO (fallback) ──────────────────
    const backSpatialAddr = backBlocks
      ? extractAddressFromSpatialExpert(
          classifyBackBlocks(backBlocks).addressBlocks,
        )
      : null;

    // ─── 4. Extracción textual del REVERSO (fallback) ───────────────────
    const backLines = back
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= 2);
    const backTextAddr = extractDomicilioExpert(backLines);

    // Elegir la mejor fuente (mayor confianza)
    // Damos un boost de +0.05 al frente (es la ubicación canónica)
    const candidates: { value: string; confidence: number; source: string }[] =
      [];
    if (frontSpatialAddr?.value) {
      candidates.push({
        value: frontSpatialAddr.value,
        confidence: Math.min(frontSpatialAddr.confidence + 0.05, 1.0),
        source: "front_spatial",
      });
    }
    if (frontTextAddr?.value) {
      candidates.push({
        value: frontTextAddr.value,
        confidence: Math.min(frontTextAddr.confidence + 0.05, 1.0),
        source: "front_text",
      });
    }
    if (backSpatialAddr?.value) {
      candidates.push({
        value: backSpatialAddr.value,
        confidence: backSpatialAddr.confidence,
        source: "back_spatial",
      });
    }
    if (backTextAddr?.value) {
      candidates.push({
        value: backTextAddr.value,
        confidence: backTextAddr.confidence,
        source: "back_text",
      });
    }

    // Seleccionar candidato con mayor confianza
    candidates.sort((a, b) => b.confidence - a.confidence);
    if (candidates.length > 0) {
      res.domicilio = candidates[0].value;
      fc.domicilio = candidates[0].confidence;
    }
  }

  // ── Post-proceso: eliminar contaminación de nombres en domicilio ─────────
  // Cuando la clasificación espacial falla (p.ej. sin ancla DOMICILIO), los
  // bloques de nombre pueden caer en la zona de dirección y aparecer como
  // segmentos del domicilio. Aquí eliminamos esos segmentos si coinciden
  // exactamente con los valores de nombre ya extraídos.
  if (res.domicilio) {
    const nameValues = [res.apellidoPaterno, res.apellidoMaterno, res.nombre]
      .filter((n) => n && n.length >= 2)
      .map((n) => n.toUpperCase().trim());

    if (nameValues.length > 0) {
      // 1. Eliminar segmentos exactos (cada segmento está separado por ", ")
      const segments = res.domicilio.split(",").map((s) => s.trim());
      const cleaned = segments.filter((seg) => {
        const segUpper = seg
          .toUpperCase()
          .replace(/[^A-ZÁÉÍÓÚÑÜ\s]/g, "")
          .trim();
        return !nameValues.some((name) => segUpper === name);
      });
      res.domicilio = cleaned.join(", ").trim();

      // 2. Eliminar si el domicilio COMIENZA con el nombre completo concatenado
      const fullNameUpper = [
        res.apellidoPaterno,
        res.apellidoMaterno,
        res.nombre,
      ]
        .filter((n) => n && n.length >= 2)
        .join(" ")
        .toUpperCase();
      if (fullNameUpper.length >= 4) {
        const domUpper = res.domicilio.toUpperCase();
        if (domUpper.startsWith(fullNameUpper)) {
          res.domicilio = res.domicilio
            .slice(fullNameUpper.length)
            .replace(/^[,\s]+/, "")
            .trim();
        }
      }

      // 3. Limpiar comas huérfanas y espacios dobles
      res.domicilio = res.domicilio
        .replace(/^[,\s]+|[,\s]+$/g, "")
        .replace(/,\s*,/g, ",")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  // ── Modelo de credencial ─────────────────────────────────────────────────
  // Auto-detect primero; si falla y el brigadista indicó un hint, usar ese.
  const autoModelo = detectIneModelo(combined);
  const modeloDetected =
    autoModelo !== "unknown" ? autoModelo : (modeloHint ?? "unknown");

  // ── Aplicar correcciones aprendidas (Decisión: OCR learning) ─────────────
  // Si el parser extrajo un valor que el usuario corrigió en una captura
  // anterior, sustituirlo automáticamente antes de devolver el resultado.
  let correctionsApplied = 0;
  if (corrections) {
    const textFields: (keyof typeof res)[] = [
      "nombre",
      "apellidoPaterno",
      "apellidoMaterno",
      "claveElector",
      "curp",
      "fechaNacimiento",
      "sexo",
      "seccion",
      "registro",
      "vigencia",
      "domicilio",
    ];
    for (const field of textFields) {
      const current = res[field] as string;
      if (current) {
        const corrected = applyFieldCorrection(
          current,
          corrections,
          field as import("./ocr-corrections").IneTextFieldKey,
        );
        if (corrected !== current) {
          (res as any)[field] = corrected;
          correctionsApplied += 1;
          // Boost confidence al nivel heurístico si era baja
          if (fc[field as keyof FieldConf] < 0.75) {
            fc[field as keyof FieldConf] = 0.75;
          }
        }
      }
    }
  }

  // ── Desglose estructurado del domicilio ──────────────────────────────────
  const domicilioDesglosado = res.domicilio
    ? parseAddressComponents(res.domicilio)
    : undefined;
  const fieldSources = buildOcrFieldSources({
    res,
    frontBlocks,
    backBlocks,
    frontAddressBlocks: frontClassified?.addressBlocks,
  });

  // ── Confianza global ─────────────────────────────────────────────────────
  const confidence = computeOverallConfidence(fc, res);

  return {
    ...res,
    domicilioDesglosado,
    fieldSources,
    modeloDetected,
    confidence,
    fieldConfidence: fc,
    correctionsApplied,
  };
}
