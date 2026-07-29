/**
 * answer-shape.ts — A5 / A8 (v3 Form Engine)
 *
 * Maps raw mobile answer values to FHIR-style v3 answer envelopes:
 *   { valueString? | valueInteger? | valueDecimal? | valueBoolean? | valueArray? | valueObject? }
 *
 * This is the canonical mapper for building the HTTP payload sent to the
 * backend.  A single `extractAnswerValue(type, rawValue)` call produces the
 * correct envelope for every question type.
 *
 * Rules:
 * - One value key per answer (never mix valueString + valueInteger in one object).
 * - File types (photo, voice, …) arrive already processed by
 *   `processFileAnswers`; their value is already `{file_id, type}`, so we
 *   wrap them as `valueObject`.
 * - For unknown / future types we fall back gracefully so submission never
 *   fails on new types.
 */

// ── Type sets ─────────────────────────────────────────────────────────────────

const STRING_TYPES = new Set([
  "text",
  "textarea",
  "email",
  "phone",
  "regex",
  "curp",
  "codigo_postal",
  "string_masked",
  "seccion",
  "estado",
  "date",
  "time",
  "datetime",
  "fecha_nacimiento",
  "single_choice",
  "select",
  "radio",
  "single_choice_image",
  "barcode",
  "barcode_hidden",
  "read_only",
]);

const INTEGER_TYPES = new Set([
  "number",
  "integer",
  "slider",
  "scale",
  "rating",
  "edad",
]);

const DECIMAL_TYPES = new Set(["decimal"]);

const BOOLEAN_TYPES = new Set(["boolean", "yes_no"]);

const ARRAY_TYPES = new Set([
  "multiple_choice",
  "multiple_choice_image",
  "checkboxes",
]);

const OBJECT_TYPES = new Set([
  "location",
  "gps",
  "coordinates",
  // Photo family
  "photo",
  "image", // legacy alias for photo
  "selfie",
  "photo_no_gallery",
  "photo_canvas",
  // Audio / video
  "voice",
  "video",
  // File / document
  "file",
  "document", // legacy alias for file
  // Credentials / identity
  "signature",
  "ine_ocr",
  "ine", // legacy alias for ine_ocr
  "credential", // legacy alias for ine_ocr
  // GIS
  "gis_line",
  "gis_polygon",
  "gis_tracking_manual",
  "gis_tracking_auto",
  // Compound auto-fill — C1 (2026-06-08): zip code with settlement autocomplete
  "codigo_postal_autofill",
]);

function normalizeLocationObject(value: Record<string, unknown>) {
  const latitude =
    typeof value.latitude === "number"
      ? value.latitude
      : typeof value.lat === "number"
        ? value.lat
        : null;
  const longitude =
    typeof value.longitude === "number"
      ? value.longitude
      : typeof value.lng === "number"
        ? value.lng
        : typeof value.lon === "number"
          ? value.lon
          : null;

  if (
    latitude === null ||
    longitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return value;
  }

  return {
    ...value,
    latitude,
    longitude,
    accuracy: typeof value.accuracy === "number" ? value.accuracy : null,
    altitude: typeof value.altitude === "number" ? value.altitude : null,
    timestamp:
      typeof value.timestamp === "number" ? value.timestamp : Date.now(),
  };
}

// ── Value envelope type ───────────────────────────────────────────────────────

export type AnswerValueEnvelope =
  | { valueString: string }
  | { valueInteger: number }
  | { valueDecimal: number }
  | { valueBoolean: boolean }
  | { valueArray: unknown[] }
  | { valueObject: Record<string, unknown> }
  | Record<string, never>; // empty object when value is null/undefined

// ── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Convert a raw mobile answer value to a v3 FHIR-style envelope.
 *
 * @param type  - `field.type` string from `FormSchemaFieldResponse`
 * @param value - the raw value stored in the draft `answers` map
 * @returns     - envelope object `{valueXxx: ...}`, or `{}` for null/undefined
 */
export function extractAnswerValue(
  type: string,
  value: unknown,
): AnswerValueEnvelope {
  if (value === null || value === undefined) {
    return {} as Record<string, never>;
  }

  if (STRING_TYPES.has(type)) {
    return {
      valueString: typeof value === "string" ? value : String(value),
    };
  }

  if (INTEGER_TYPES.has(type)) {
    const n = Number(value);
    return {
      valueInteger: Number.isFinite(n) ? Math.round(n) : 0,
    };
  }

  if (DECIMAL_TYPES.has(type)) {
    const n = Number(value);
    return {
      valueDecimal: Number.isFinite(n) ? n : 0,
    };
  }

  if (BOOLEAN_TYPES.has(type)) {
    return { valueBoolean: Boolean(value) };
  }

  if (ARRAY_TYPES.has(type)) {
    return {
      valueArray: Array.isArray(value) ? value : [value],
    };
  }

  if (OBJECT_TYPES.has(type)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      if (type === "location" || type === "gps" || type === "coordinates") {
        return {
          valueObject: normalizeLocationObject(
            value as Record<string, unknown>,
          ),
        };
      }
      return { valueObject: value as Record<string, unknown> };
    }
    // Scalar file ID or unexpected shape — wrap it
    return { valueObject: { raw: value } };
  }

  // ── Unknown / future types: best-effort coercion ─────────────────────────
  if (typeof value === "boolean") return { valueBoolean: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { valueInteger: value }
      : { valueDecimal: value };
  }
  if (Array.isArray(value)) return { valueArray: value };
  if (typeof value === "object") {
    return { valueObject: value as Record<string, unknown> };
  }
  return { valueString: String(value) };
}
