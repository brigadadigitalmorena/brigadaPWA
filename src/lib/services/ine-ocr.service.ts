import Tesseract from 'tesseract.js';

export interface IneOcrResult {
  text: string;
  confidence: number;
  data: Record<string, string>;
  lowConfidence: boolean;
  side: 'front' | 'back';
  validationWarnings: string[];
}

const CURP_REGEX = /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}/;
const YEAR_REGEX = /\b(20\d{2})\b/;

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\|/g, 'I')
    .trim();
}

function normalizeOcrText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[\r\n]+/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/[ÓÒÔÖ]/g, 'O')
    .replace(/[ÁÀÂÄ]/g, 'A')
    .replace(/[ÉÈÊË]/g, 'E')
    .replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[ÚÙÛÜ]/g, 'U')
    .replace(/[Ñ]/g, 'N')
    .replace(/[^A-Z0-9\s\n#.,-]/g, '')
    .trim();
}

/**
 * Validate Mexican CURP checksum digit.
 * Returns true if the 18th digit matches the calculated checksum.
 */
export function validateCurpChecksum(curp: string): boolean {
  if (curp.length !== 18) return false;

  const chars = curp.slice(0, 17).split('');
  const checkDigit = curp[17];

  const values: Record<string, number> = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17, 'I': 18,
    'J': 19, 'K': 20, 'L': 21, 'M': 22, 'N': 23, 'Ñ': 24, 'O': 25, 'P': 26, 'Q': 27,
    'R': 28, 'S': 29, 'T': 30, 'U': 31, 'V': 32, 'W': 33, 'X': 34, 'Y': 35, 'Z': 36,
  };

  let sum = 0;
  chars.forEach((char, index) => {
    const value = values[char] ?? 0;
    sum += value * (18 - index);
  });

  const remainder = sum % 10;
  const expectedDigit = remainder === 0 ? '0' : String(10 - remainder);

  return checkDigit === expectedDigit;
}

function extractCurp(text: string): { value: string; valid: boolean } | undefined {
  const match = text.match(CURP_REGEX);
  if (!match) return undefined;

  const value = match[0];
  return { value, valid: validateCurpChecksum(value) };
}

function extractVigencia(text: string): string | undefined {
  const vigenciaMatch = text.match(/VIGENCIA\s*(20\d{2})/i);
  if (vigenciaMatch) return vigenciaMatch[1];

  const yearMatch = text.match(YEAR_REGEX);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    const currentYear = new Date().getFullYear();
    if (year >= currentYear && year <= currentYear + 15) {
      return yearMatch[1];
    }
  }

  return undefined;
}

function extractNombre(text: string): string | undefined {
  const nombreMatch = text.match(/NOMBRE\s*[:\-]?\s*([^\n]{3,120})/i);
  if (nombreMatch) {
    const raw = cleanText(nombreMatch[1]);
    // Stop at common delimiters
    const parts = raw.split(/\s{3,}|DOMICILIO|DIRECCION|CURP|FECHA|SEXO/);
    const name = parts[0].trim();
    if (name.length > 3) return name;
  }

  return undefined;
}

function extractDomicilio(text: string): string | undefined {
  const domicilioMatch = text.match(/DOMICILIO\s*[:\-]?\s*([^\n]{5,200})/i);
  if (domicilioMatch) {
    const raw = cleanText(domicilioMatch[1]);
    const parts = raw.split(/\s{3,}|CURP|FECHA|SECCION|SEXO/);
    const address = parts[0].trim();
    if (address.length > 5) return address;
  }

  const direccionMatch = text.match(/DIRECCION\s*[:\-]?\s*([^\n]{5,200})/i);
  if (direccionMatch) {
    const raw = cleanText(direccionMatch[1]);
    const parts = raw.split(/\s{3,}|CURP|FECHA|SECCION|SEXO/);
    const address = parts[0].trim();
    if (address.length > 5) return address;
  }

  return undefined;
}

function extractClaveElector(text: string): string | undefined {
  const match = text.match(/CLAVE\s*DE\s*ELECTOR\s*[:\-]?\s*([A-Z0-9]{18})/i);
  if (match) return match[1];

  // INE back has an 18-character key in uppercase, usually near the top
  const lines = text.split('\n');
  for (const line of lines) {
    const possible = line.match(/\b([A-Z0-9]{18})\b/);
    if (possible && /[A-Z]/.test(possible[1]) && /\d/.test(possible[1])) {
      return possible[1];
    }
  }

  return undefined;
}

function extractSeccion(text: string): string | undefined {
  const match = text.match(/SECCION\s*[:\-]?\s*(\d{1,4})/i);
  return match ? match[1] : undefined;
}

function extractCic(text: string): string | undefined {
  // CIC is a numeric code, often labeled or near the magnetic stripe
  const match = text.match(/CIC\s*[:\-]?\s*(\d{9})/i);
  if (match) return match[1];

  const possible = text.match(/\b(\d{9})\b/);
  if (possible) return possible[1];

  return undefined;
}

function extractFechaNacimiento(curp: string): string | undefined {
  if (curp.length !== 18) return undefined;

  const year = curp.slice(4, 6);
  const month = curp.slice(6, 8);
  const day = curp.slice(8, 10);

  const fullYear = parseInt(year) >= 50 ? `19${year}` : `20${year}`;
  return `${fullYear}-${month}-${day}`;
}

/**
 * Detect INE model letter from OCR text.
 */
export function detectIneModel(text: string): string | undefined {
  const upperText = text.toUpperCase();
  const match = upperText.match(/\bMODELO\s*[:\-]?\s*([A-E])\b/);
  if (match) return match[1];

  const fallback = upperText.match(/\b[ABCDEF]\b/);
  return fallback ? fallback[0] : undefined;
}

function collectValidationWarnings(
  side: 'front' | 'back',
  curp?: { value: string; valid: boolean },
  vigencia?: string,
  ine_modelo?: string
): string[] {
  const warnings: string[] = [];

  if (!curp) {
    warnings.push('No se detectó CURP');
  } else if (!curp.valid) {
    warnings.push('CURP detectado pero dígito verificador no coincide');
  }

  if (side === 'front') {
    if (!vigencia) warnings.push('No se detectó año de vigencia');
    if (!ine_modelo) warnings.push('No se detectó modelo de INE');
  }

  return warnings;
}

/**
 * Run OCR on an INE image and extract structured fields.
 *
 * @param imageSource - Image URL, File, or Blob.
 * @param side - Whether this is the front or back of the INE.
 */
export async function recognizeIne(
  imageSource: string | File | Blob,
  side: 'front' | 'back'
): Promise<IneOcrResult> {
  const result = await Tesseract.recognize(imageSource, 'spa', {
    logger: () => {
      // Progress logs can be wired to a UI callback later.
    },
  });

  const rawText = cleanText(result.data.text);
  const normalizedText = normalizeOcrText(rawText);
  const confidence = result.data.confidence / 100;
  const lowConfidence = confidence < 0.7;

  const curp = extractCurp(normalizedText);
  const vigencia = extractVigencia(normalizedText);
  const ine_modelo = detectIneModel(normalizedText);

  const baseData: Record<string, string> = {
    raw_text: rawText,
    normalized_text: normalizedText,
    side,
    ine_modelo: ine_modelo || '',
  };

  if (side === 'front') {
    const fecha_nacimiento = curp ? extractFechaNacimiento(curp.value) : '';

    return {
      text: rawText,
      confidence,
      lowConfidence,
      side,
      validationWarnings: collectValidationWarnings(side, curp, vigencia, ine_modelo),
      data: {
        ...baseData,
        curp: curp?.value || '',
        curp_valido: curp?.valid ? 'true' : 'false',
        nombre: extractNombre(normalizedText) || '',
        domicilio: extractDomicilio(normalizedText) || '',
        vigencia: vigencia || '',
        fecha_nacimiento: fecha_nacimiento || '',
      },
    };
  }

  return {
    text: rawText,
    confidence,
    lowConfidence,
    side,
    validationWarnings: collectValidationWarnings(side, curp, undefined, undefined),
    data: {
      ...baseData,
      curp: curp?.value || '',
      curp_valido: curp?.valid ? 'true' : 'false',
      clave_elector: extractClaveElector(normalizedText) || '',
      seccion: extractSeccion(normalizedText) || '',
      cic: extractCic(normalizedText) || '',
    },
  };
}
