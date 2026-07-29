/**
 * 🔤 INE MRZ (Machine Readable Zone) Parser
 * ==========================================
 *
 * Parsea la Machine Readable Zone (formato TD1 de ICAO 9303) del reverso
 * de la credencial INE/IFE de México.
 *
 * ── Formato TD1 (tarjeta tamaño ID-1) ──────────────────────────────────────
 *
 *   La INE usa ICAO 9303 TD1 con 3 líneas × 30 caracteres:
 *
 *   Línea 1: I<MEX[NumDocumento:9][CD][Opcional:15]
 *   Línea 2: [FechaNac:YYMMDD][CD][Sexo:M/F][FechaExp:YYMMDD][CD][MEX][Opc][CD]
 *   Línea 3: [Apellidos<<NombresCompletos, relleno con <]
 *
 * ── Codificación de nombres en Línea 3 ─────────────────────────────────────
 *
 *   Formato: PATERNO<MATERNO<<NOMBRE1<NOMBRE2<<<<<<<<
 *
 *   Donde:
 *     - `<` simple separa partes dentro de apellidos o nombres
 *     - `<<` doble separa el grupo de apellidos del grupo de nombres
 *     - `<` trailing son relleno hasta completar 30 caracteres
 *
 *   Ejemplo:
 *     GARCIA<LOPEZ<<JUAN<ANTONIO<<<<<<<<<<<<
 *     → Paterno: GARCIA, Materno: LOPEZ, Nombre: JUAN ANTONIO
 *
 * ── Consideraciones ML Kit ──────────────────────────────────────────────────
 *
 *   ML Kit puede confundir `<` con K, (, {, [, C, o simplemente omitirlo.
 *   Este parser maneja los errores OCR más comunes del MRZ:
 *     - `<` leído como K (más frecuente en OCR-B font)
 *     - Confusiones O↔0, I↔1 estándar
 *     - Líneas fusionadas o separadas diferente
 *
 * ── Mapeo de sexo ───────────────────────────────────────────────────────────
 *
 *   ICAO MRZ: M=Male, F=Female
 *   INE:      H=Hombre, M=Mujer
 *   Mapeo:    MRZ 'M' → INE 'H',  MRZ 'F' → INE 'M'
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MrzData {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
  fechaNacimiento: string; // DD/MM/YYYY
  sexo: string; // H | M (formato INE)
  confidence: number; // 0–1
}

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Longitud mínima y máxima de una línea MRZ.
 * TD1 especifica 30, pero con errores OCR puede variar ±5.
 */
const MRZ_LINE_MIN_LEN = 25;
const MRZ_LINE_MAX_LEN = 40;

/**
 * Mínimo de caracteres `<` para considerar una línea como MRZ.
 * Una línea MRZ de nombres típica tiene 5+ fillers.
 */
const MRZ_MIN_FILLERS = 2;

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Detecta y parsea las líneas MRZ del texto OCR crudo.
 *
 * **DEBE llamarse con el texto CRUDO, ANTES de normalizeOcrText()** ya que
 * esa función elimina líneas con `<`. El texto no necesita estar normalizado;
 * esta función hace su propia normalización interna.
 *
 * @param rawBackText   Texto crudo del reverso de la INE (contiene MRZ)
 * @param rawFrontText  Texto crudo del anverso (algunos modelos tienen MRZ parcial)
 * @returns Datos parseados del MRZ o null si no se detectó/parseó
 */
export function parseMrz(
  rawBackText: string | null,
  rawFrontText: string | null = null,
): MrzData | null {
  // El MRZ está en el reverso; el anverso es fallback
  const text = rawBackText ?? rawFrontText ?? "";
  if (!text || text.length < 30) return null;

  const lines = text.split("\n").map((l) => l.trim().toUpperCase());

  // ── Paso 1: Encontrar líneas candidatas a MRZ ──────────────────────────
  // Filtrar por: longitud apropiada + presencia de fillers (<)
  const mrzCandidates = lines.filter((l) => {
    if (l.length < MRZ_LINE_MIN_LEN || l.length > MRZ_LINE_MAX_LEN) {
      return false;
    }
    const fillerCount = (l.match(/</g) || []).length;
    return fillerCount >= MRZ_MIN_FILLERS;
  });

  // Necesitamos al menos la línea de nombres (línea 3 del TD1)
  if (mrzCandidates.length === 0) return null;

  // ── Paso 2: Identificar la línea de nombres (Línea 3) ──────────────────
  const nameLine = findMrzNameLine(mrzCandidates);
  if (!nameLine) return null;

  // ── Paso 3: Parsear nombres ─────────────────────────────────────────────
  const names = parseMrzNames(nameLine);
  if (!names) return null;

  // ── Paso 4: Buscar y parsear línea de datos (Línea 2) ──────────────────
  const dataLine = findMrzDataLine(mrzCandidates, nameLine);
  let fechaNacimiento = "";
  let sexo = "";

  if (dataLine) {
    const data = parseMrzDataLine(dataLine);
    fechaNacimiento = data.fechaNacimiento;
    sexo = data.sexo;
  }

  // ── Paso 5: Calcular confianza ──────────────────────────────────────────
  let confidence = 0.65; // Base: encontramos y parseamos línea de nombres
  if (names.apellidoPaterno.length >= 2) confidence += 0.1;
  if (names.apellidoMaterno.length >= 2) confidence += 0.05;
  if (names.nombre.length >= 2) confidence += 0.1;
  if (fechaNacimiento) confidence += 0.05;
  if (sexo) confidence += 0.03;

  return {
    ...names,
    fechaNacimiento,
    sexo,
    confidence: Math.min(confidence, 0.98),
  };
}

// ── Funciones de detección de líneas MRZ ──────────────────────────────────────

/**
 * Busca la línea de nombres del MRZ.
 *
 * La línea de nombres tiene el patrón: APELLIDOS<<NOMBRES
 * Contiene `<<` que separa el grupo de apellidos del de nombres.
 *
 * Tanto antes como después de `<<` debe haber texto con letras.
 */
function findMrzNameLine(candidates: string[]): string | null {
  // Prioridad 1: líneas con << claro
  for (const line of candidates) {
    if (!line.includes("<<")) continue;

    const [beforeDouble, ...afterParts] = line.split("<<");
    const afterDouble = afterParts.join("<<"); // En caso de múltiples <<

    const surnameText = beforeDouble.replace(/</g, " ").trim();
    const givenText = afterDouble.replace(/</g, " ").trim();

    // Debe haber al menos 2 letras en cada sección
    if (/[A-Z]{2,}/.test(surnameText) && /[A-Z]{2,}/.test(givenText)) {
      return line;
    }
  }

  // Prioridad 2: líneas con patrón LETRAS<LETRAS (sin el doble << claro)
  // ML Kit a veces omite un < del par <<
  for (const line of candidates) {
    // Buscar patrón: varias letras, un grupo de <, más letras
    const match = line.match(
      /([A-Z]{2,}(?:<[A-Z]+)*)<{1,3}([A-Z]{2,}(?:<[A-Z]+)*)/,
    );
    if (match) {
      const [, surnames, givens] = match;
      if (
        surnames.replace(/</g, " ").trim().length >= 2 &&
        givens.replace(/</g, " ").trim().length >= 2
      ) {
        return line;
      }
    }
  }

  return null;
}

/**
 * Parsea los nombres de la línea MRZ de nombres.
 *
 * Formato esperado: PATERNO<MATERNO<<NOMBRE1<NOMBRE2<<<<
 *
 * @returns Nombres estructurados o null si no se pudo parsear
 */
function parseMrzNames(nameLine: string): {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombre: string;
} | null {
  const doubleFillerIdx = nameLine.indexOf("<<");
  if (doubleFillerIdx === -1) return null;

  // Sección de apellidos: todo antes del <<
  const surnameSection = nameLine.substring(0, doubleFillerIdx);

  // Sección de nombres: todo después del <<, sin fillers trailing
  let givenSection = nameLine
    .substring(doubleFillerIdx)
    .replace(/^<+/, "") // Quitar << iniciales
    .replace(/<+$/, ""); // Quitar trailing <

  // Dentro de apellidos, < simple separa paterno de materno
  const surnames = surnameSection
    .split("<")
    .filter((s) => s.length > 0)
    .map((s) => cleanMrzValue(s));

  // Dentro de nombres, < simple separa nombre(s)
  const givenNames = givenSection
    .split("<")
    .filter((s) => s.length > 0)
    .map((s) => cleanMrzValue(s));

  if (surnames.length === 0 && givenNames.length === 0) return null;

  return {
    apellidoPaterno: surnames[0] ?? "",
    apellidoMaterno: surnames.slice(1).join(" "),
    nombre: givenNames.join(" "),
  };
}

/**
 * Busca la línea de datos del MRZ (Línea 2).
 *
 * La línea 2 contiene fecha de nacimiento (YYMMDD), sexo (M/F),
 * fecha de expiración (YYMMDD), y nacionalidad (MEX).
 *
 * Patrón: 6 dígitos (DOB) + check digit + M/F + 6 dígitos (expiry) + ...
 */
function findMrzDataLine(
  candidates: string[],
  nameLine: string,
): string | null {
  for (const line of candidates) {
    if (line === nameLine) continue;
    // Buscar patrón: 6-7 dígitos seguidos de M o F (indicador de sexo ICAO)
    if (/\d{6,7}[MF<]/.test(line)) return line;
    // Variante: dígitos + MEX (nacionalidad)
    if (/\d{6}.*MEX/.test(line)) return line;
  }
  return null;
}

/**
 * Parsea fecha de nacimiento y sexo de la línea de datos MRZ.
 *
 * Posiciones estándar TD1 línea 2:
 *   [0-5]  YYMMDD fecha de nacimiento
 *   [6]    Check digit
 *   [7]    Sexo (M/F en ICAO)
 *   [8-13] YYMMDD fecha de expiración
 *   [14]   Check digit
 *   [15-17] Nacionalidad (MEX)
 */
function parseMrzDataLine(dataLine: string): {
  fechaNacimiento: string;
  sexo: string;
} {
  let fechaNacimiento = "";
  let sexo = "";

  // Extraer fecha de nacimiento (YYMMDD)
  const dobMatch = dataLine.match(
    /(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/,
  );
  if (dobMatch) {
    const [, yy, mm, dd] = dobMatch;
    const yyNum = parseInt(yy, 10);
    // Siglo dinámico: votantes en México deben tener ≥ 18 años
    const currentYear = new Date().getFullYear();
    const cutoff = (currentYear - 18) % 100;
    const century = yyNum <= cutoff ? 2000 : 1900;
    const year = century + yyNum;
    fechaNacimiento = `${dd}/${mm}/${year}`;
  }

  // Extraer sexo (ICAO: M=Male, F=Female → INE: H=Hombre, M=Mujer)
  const sexMatch = dataLine.match(/\d[MF]/);
  if (sexMatch) {
    const icaoSex = sexMatch[0][1];
    sexo = icaoSex === "M" ? "H" : "M";
  }

  return { fechaNacimiento, sexo };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Limpia un valor extraído del MRZ.
 * Elimina fillers residuales y caracteres no alfabéticos.
 */
function cleanMrzValue(raw: string): string {
  return raw
    .replace(/[<]/g, " ")
    .replace(/[^A-ZÁÉÍÓÚÑÜ\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
