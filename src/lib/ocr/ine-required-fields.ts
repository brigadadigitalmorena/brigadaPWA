/**
 * INE Required Fields Configuration
 *
 * Mirrors the *convention* of brigadaApp/lib/ocr/ine-required-fields.ts (camelCase
 * keys, matching `INEOcrResult` and the backend `required_fields` config in
 * backEnd/scripts/seed_v2_full.py).
 *
 * Deliberate deviation: the App defaults to 13 fields (including back-side only
 * fields like `domicilio`, `vigencia`, `seccion`, `cic`). Those make a required
 * INE question unsubmittable whenever back-side OCR under-extracts, which is a
 * hard block in the field. We default to the 4 fields that carry the identity
 * signal and let the office opt into more via `validation_rules.required_fields`.
 *
 * See ai-context/07-known-bugs.md#PWA-P0-4 and 10-backlog.md#P1-1.
 */

export const DEFAULT_REQUIRED_INE_FIELDS = [
  "front",
  "back",
  "nombre",
  "curp",
] as const;

export type IneRequiredField = (typeof DEFAULT_REQUIRED_INE_FIELDS)[number];

/**
 * Human labels for missing-field errors.
 *
 * Covers both key conventions so an error never leaks a raw key:
 *  - camelCase: `required_fields` from the backend config, `IneOcrResult.data`
 *  - snake_case: the flat answer emitted by buildFlatIneAnswer
 */
export const INE_REQUIRED_FIELD_LABELS: Record<string, string> = {
  front: "Frente",
  back: "Reverso",
  ocrData: "Datos OCR",
  nombre: "Nombre(s)",
  apellidoPaterno: "Apellido paterno",
  apellido_paterno: "Apellido paterno",
  apellidoMaterno: "Apellido materno",
  apellido_materno: "Apellido materno",
  claveElector: "Clave de elector",
  clave_elector: "Clave de elector",
  ocrNumber: "Número de OCR",
  ocr_number: "Número de OCR",
  cic: "CIC",
  curp: "CURP",
  fechaNacimiento: "Fecha de nacimiento",
  fecha_nacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
  seccion: "Sección",
  registro: "Año de registro",
  vigencia: "Vigencia",
  domicilio: "Domicilio",
};
