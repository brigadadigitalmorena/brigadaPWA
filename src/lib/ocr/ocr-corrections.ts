/**
 * OCR correction learning — web/localStorage adapter (no React Native).
 */

export type IneTextFieldKey =
  | 'nombre'
  | 'apellidoPaterno'
  | 'apellidoMaterno'
  | 'claveElector'
  | 'curp'
  | 'fechaNacimiento'
  | 'sexo'
  | 'seccion'
  | 'registro'
  | 'vigencia'
  | 'cic'
  | 'ocrNumber'
  | 'domicilio';

export type FieldCorrections = Partial<
  Record<IneTextFieldKey, Record<string, string>>
>;

const CORRECTIONS_KEY = 'ine_ocr_corrections_v1';
const MAX_CORRECTIONS_PER_FIELD = 50;

function normalizeKey(value: string): string {
  return value.trim().toUpperCase().normalize('NFC');
}

function readStorage(): FieldCorrections {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CORRECTIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FieldCorrections;
  } catch {
    return {};
  }
}

function writeStorage(value: FieldCorrections): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export async function loadCorrections(): Promise<FieldCorrections> {
  return readStorage();
}

export async function saveCorrection(
  field: IneTextFieldKey,
  rawValue: string,
  correctedValue: string
): Promise<FieldCorrections> {
  const rawKey = normalizeKey(rawValue);
  const corrKey = normalizeKey(correctedValue);

  if (!rawKey || !corrKey || rawKey === corrKey) {
    return loadCorrections();
  }

  const existing = await loadCorrections();
  const fieldMap: Record<string, string> = { ...(existing[field] ?? {}) };

  const keys = Object.keys(fieldMap);
  if (keys.length >= MAX_CORRECTIONS_PER_FIELD) {
    delete fieldMap[keys[0]];
  }

  fieldMap[rawKey] = correctedValue.trim();
  existing[field] = fieldMap;
  writeStorage(existing);
  return existing;
}

export function applyFieldCorrection(
  value: string,
  corrections: FieldCorrections,
  field: IneTextFieldKey
): string {
  const fieldMap = corrections[field];
  if (!fieldMap) return value;
  const key = normalizeKey(value);
  return fieldMap[key] ?? value;
}

export async function clearAllCorrections(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(CORRECTIONS_KEY);
}
