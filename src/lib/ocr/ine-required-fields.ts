/**
 * INE Required Fields Configuration
 *
 * Mirrors brigadaApp/lib/ocr/ine-required-fields.ts
 * These are the default fields that must be present in an INE answer
 * when the question is required and no custom `required_fields` are specified.
 */

export const DEFAULT_REQUIRED_INE_FIELDS = [
  "front",
  "back",
  "nombre",
  "apellido_paterno",
  "apellido_materno",
  "curp",
  "clave_elector",
  "fecha_nacimiento",
  "sexo",
  "seccion",
  "vigencia",
  "cic",
  "domicilio",
] as const;

export type IneRequiredField = (typeof DEFAULT_REQUIRED_INE_FIELDS)[number];

export const INE_REQUIRED_FIELD_LABELS: Record<string, string> = {
  front: "Frente",
  back: "Reverso",
  ocrData: "Datos OCR",
  nombre: "Nombre(s)",
  apellido_paterno: "Apellido paterno",
  apellido_materno: "Apellido materno",
  clave_elector: "Clave de elector",
  ocr_number: "OCR",
  cic: "CIC",
  curp: "CURP",
  fecha_nacimiento: "Fecha de nacimiento",
  sexo: "Sexo",
  seccion: "Sección",
  registro: "Año de registro",
  vigencia: "Vigencia",
  domicilio: "Domicilio",
};