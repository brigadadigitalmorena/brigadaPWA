import Tesseract from 'tesseract.js';
import { parseIneOcrText, loadCorrections } from '@/lib/ocr';

export interface IneOcrResult {
  text: string;
  confidence: number;
  data: Record<string, string>;
  lowConfidence: boolean;
  side: 'front' | 'back';
  validationWarnings: string[];
}

/** Validate Mexican CURP checksum digit. */
export function validateCurpChecksum(curp: string): boolean {
  if (curp.length !== 18) return false;

  const chars = curp.slice(0, 17).split('');
  const checkDigit = curp[17];

  const values: Record<string, number> = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 18,
    J: 19, K: 20, L: 21, M: 22, N: 23, Ñ: 24, O: 25, P: 26, Q: 27,
    R: 28, S: 29, T: 30, U: 31, V: 32, W: 33, X: 34, Y: 35, Z: 36,
  };

  let sum = 0;
  chars.forEach((char, index) => {
    sum += (values[char] ?? 0) * (18 - index);
  });

  const remainder = sum % 10;
  const expectedDigit = remainder === 0 ? '0' : String(10 - remainder);
  return checkDigit === expectedDigit;
}

/**
 * Run Tesseract OCR then parse with the shared mobile INE parser.
 */
export async function recognizeIne(
  imageSource: string | File | Blob,
  side: 'front' | 'back'
): Promise<IneOcrResult> {
  const result = await Tesseract.recognize(imageSource, 'spa', {
    logger: () => {},
  });

  const rawText = result.data.text || '';
  const corrections = await loadCorrections();

  const frontText = side === 'front' ? rawText : null;
  const backText = side === 'back' ? rawText : null;

  const parsed = parseIneOcrText(
    frontText,
    backText,
    undefined,
    undefined,
    undefined,
    corrections
  );

  const data: Record<string, string> = {
    raw_text: rawText,
    side,
    ine_modelo: parsed.modeloDetected || '',
    nombre: parsed.nombre || '',
    apellidoPaterno: parsed.apellidoPaterno || '',
    apellidoMaterno: parsed.apellidoMaterno || '',
    curp: parsed.curp || '',
    claveElector: parsed.claveElector || '',
    ocrNumber: parsed.ocrNumber || '',
    cic: parsed.cic || '',
    fechaNacimiento: parsed.fechaNacimiento || '',
    sexo: parsed.sexo || '',
    seccion: parsed.seccion || '',
    registro: parsed.registro || '',
    vigencia: parsed.vigencia || '',
    domicilio: parsed.domicilio || '',
  };

  if (parsed.claveElector) data.clave_elector = parsed.claveElector;
  if (parsed.fechaNacimiento) data.fecha_nacimiento = parsed.fechaNacimiento;
  if (parsed.curp) {
    data.curp_valido = validateCurpChecksum(parsed.curp) ? 'true' : 'false';
  }

  const validationWarnings: string[] = [];
  if (!parsed.curp) validationWarnings.push('No se detectó CURP');
  if (side === 'front' && !parsed.nombre) validationWarnings.push('No se detectó nombre');
  if (side === 'front' && !parsed.vigencia) validationWarnings.push('No se detectó vigencia');
  if (side === 'back' && !parsed.claveElector) {
    validationWarnings.push('No se detectó clave de elector');
  }

  const confidence = Math.max(result.data.confidence / 100, parsed.confidence || 0);
  const lowConfidence =
    confidence < 0.7 || (parsed.confidence > 0 && parsed.confidence < 0.55);

  return {
    text: rawText,
    confidence,
    data,
    lowConfidence,
    side,
    validationWarnings,
  };
}
