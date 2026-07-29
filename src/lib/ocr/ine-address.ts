/**
 * 🏠 Extracción experta de domicilio de la INE
 * =============================================
 *
 * Este módulo implementa una cascada de 5 estrategias independientes para
 * extraer la dirección de la INE, priorizando por confianza.
 *
 * NOTA: El domicilio está en el FRENTE de la INE, entre los nombres y los
 * datos de identificación (CURP, CLAVE, SECCIÓN). El reverso se busca
 * como fallback para modelos antiguos de IFE.
 *
 * ── Filosofía ───────────────────────────────────────────────────────────────
 *
 * En vez de depender de una sola ancla ("DOMICILIO"), atacamos el problema
 * desde múltiples ángulos:
 *
 *   1. ANCLA DIRECTA   – Encontrar "DOMICILIO" y leer lo que sigue.
 *   2. CÓDIGO POSTAL    – Los 5 dígitos de C.P. son un ancla muy fuerte.
 *                         La dirección siempre está alrededor del C.P.
 *   3. ESTADO MEXICANO  – Si detectamos un nombre de estado (CDMX, JALISCO…)
 *                         la dirección termina ahí. Iniciamos hacia atrás.
 *   4. COLONIA/COL.     – Patrón muy reconocible. La calle está arriba.
 *   5. FILTRADO NEGATIVO – Último recurso: tomamos TODO el texto y quitamos
 *                         lo que sabemos que NO es dirección (CURP, clave,
 *                         MRZ, fechas, encabezados institucionales…).
 *                         Lo que sobra es probablemente dirección.
 *
 * Cada estrategia produce un candidato con score. Se elige el mejor.
 *
 * ── Estructura de dirección mexicana ────────────────────────────────────────
 *
 *   CALLE/AV/BLVD NOMBRE  NUM [INT NUM]
 *   COL./COLONIA/FRACC. NOMBRE_COLONIA
 *   C.P. XXXXX  MUNICIPIO/DELEGACIÓN NOMBRE
 *   ESTADO
 *
 *   o variantes compactas:
 *
 *   CALLE NOMBRE 123
 *   COL NOMBRE 06000 MUNICIPIO
 *   ESTADO
 *
 * ── Heurísticas de scoring ──────────────────────────────────────────────────
 *
 *   • C.P. presente (5 dígitos en contexto)    → +0.25
 *   • Número exterior (1-5 dígitos near text)  → +0.15
 *   • Colonia detectada                        → +0.15
 *   • Estado mexicano detectado                → +0.20
 *   • Municipio/delegación detectada           → +0.10
 *   • 2+ líneas de contenido                   → +0.10
 *   • Sin CURP/clave mezclados (penalty)       → +0.05
 *   • Base                                     → +0.10 (si hay cualquier texto)
 *   ─────────────────────────────────────
 *   Máximo teórico: 1.10 → clamped a 1.0
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DATOS GEOGRÁFICOS DE MÉXICO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Los 32 estados de México, incluyendo variantes comunes y con/sin acento.
 * Se usa tanto para detectar estados en texto OCR como para validar
 * que la dirección parece plausible.
 */
const MEXICAN_STATES_LIST: string[] = [
  "AGUASCALIENTES",
  "BAJA CALIFORNIA SUR",
  "BAJA CALIFORNIA",
  "CAMPECHE",
  "CHIAPAS",
  "CHIHUAHUA",
  "CIUDAD DE MEXICO",
  "CIUDAD DE MÉXICO",
  "COAHUILA",
  "COLIMA",
  "DURANGO",
  "ESTADO DE MEXICO",
  "ESTADO DE MÉXICO",
  "GUANAJUATO",
  "GUERRERO",
  "HIDALGO",
  "JALISCO",
  "MICHOACAN",
  "MICHOACÁN",
  "MORELOS",
  "NAYARIT",
  "NUEVO LEON",
  "NUEVO LEÓN",
  "OAXACA",
  "PUEBLA",
  "QUERETARO",
  "QUERÉTARO",
  "QUINTANA ROO",
  "SAN LUIS POTOSI",
  "SAN LUIS POTOSÍ",
  "SINALOA",
  "SONORA",
  "TABASCO",
  "TAMAULIPAS",
  "TLAXCALA",
  "VERACRUZ",
  "YUCATAN",
  "YUCATÁN",
  "ZACATECAS",
];

/** Abreviaciones comunes de estados en la INE */
const STATE_ABBREVIATIONS: Record<string, string> = {
  AGS: "AGUASCALIENTES",
  BC: "BAJA CALIFORNIA",
  BCS: "BAJA CALIFORNIA SUR",
  CAMP: "CAMPECHE",
  CHIS: "CHIAPAS",
  CHIH: "CHIHUAHUA",
  CDMX: "CIUDAD DE MEXICO",
  "CD. DE MEXICO": "CIUDAD DE MEXICO",
  "CD. MEXICO": "CIUDAD DE MEXICO",
  DF: "CIUDAD DE MEXICO",
  "D.F.": "CIUDAD DE MEXICO",
  COAH: "COAHUILA",
  COL: "COLIMA", // Nota: puede confundirse con "COL." de "COLONIA"
  DGO: "DURANGO",
  EDOMEX: "ESTADO DE MEXICO",
  "EDO. DE MEXICO": "ESTADO DE MEXICO",
  "EDO. MEX": "ESTADO DE MEXICO",
  "EDO MEX": "ESTADO DE MEXICO",
  GTO: "GUANAJUATO",
  GRO: "GUERRERO",
  HGO: "HIDALGO",
  JAL: "JALISCO",
  MICH: "MICHOACAN",
  MOR: "MORELOS",
  NAY: "NAYARIT",
  NL: "NUEVO LEON",
  "N.L.": "NUEVO LEON",
  OAX: "OAXACA",
  PUE: "PUEBLA",
  QRO: "QUERETARO",
  QROO: "QUINTANA ROO",
  "Q. ROO": "QUINTANA ROO",
  SLP: "SAN LUIS POTOSI",
  SIN: "SINALOA",
  SON: "SONORA",
  TAB: "TABASCO",
  TAMPS: "TAMAULIPAS",
  TLAX: "TLAXCALA",
  VER: "VERACRUZ",
  YUC: "YUCATAN",
  ZAC: "ZACATECAS",
};

// Los sets de búsqueda se construyen inline en detectState() para
// soportar matching por longitud descendente y abreviaciones con contexto.

// ═══════════════════════════════════════════════════════════════════════════════
// PATRONES DE DETECCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/** Código Postal: "C.P. 12345" o "CP 12345" o "C P 12345" */
const CP_LABELED_RE = /C\.?\s*P\.?\s*(\d{5})/i;
/** Código Postal sin label: 5 dígitos aislados (pueden ser CP si en contexto) */
const CP_BARE_RE = /\b(\d{5})\b/;

/** Etiqueta DOMICILIO con tolerancia OCR */
const DOMICILIO_RE = /D[O0]M[I1]C[I1]L[I1][O0]/i;

/** Patrón de colonia: COL., COLONIA, FRACC., etc. */
const COLONIA_RE =
  /\b(?:COL\.?\s|COLON[I1]A\s|FRACC\.?\s|FRACC[I1]ONAM[I1]ENTO\s|UN[I1]DAD\sHAB|BARR[I1]O\s|PUEBLO\s)/i;

/** Patrón de tipo de vialidad (inicio de dirección) */
const STREET_TYPE_RE =
  /^(?:CALLE|C\.?\s|AV\.?\s|AVDA\.?\s|AVEN[I1]DA|BLVD\.?\s|BOULEVARD|PR[I1]V\.?\s|PR[I1]VADA|AND\.?\s|ANDADOR|CDA\.?\s|CERRADA|PROL\.?\s|PROLONGAC[I1][OÓ]N|CALZ\.?\s|CALZADA|CAM[I1]NO|CARR\.?\s|CARRETERA|CJON\.?\s|CALLEJON|CIRCUITO|CANAL|PASEO|PLAZA|RET\.?\s|RETORNO|VEREDA)/i;

/** Municipio/Delegación/Alcaldía */
const MUNICIPIO_RE =
  /\b(?:MUN[I1]C[I1]P[I1]O|DELEGAC[I1][OÓ]N|DELEG\.?|ALCALD[IÍ]A|MPIO\.?)\s/i;

// ── Patrones NEGATIVOS (definitivamente NO es dirección) ───────────────────

/** CURP: 4 letras + 6 dígitos + letra + 5 letras + 2 alfanuméricos */
const CURP_RE = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]{2}\b/;
/** Clave de Elector: 18 letras mayúsculas */
const CLAVE_RE = /\b[A-Z]{18}\b/;
/** MRZ: tres o más < consecutivos */
const MRZ_RE = /<<<+/;
/** Fechas de emisión/vigencia */
const DATE_LABEL_RE = /^(?:FECHA|EM[I1]S[I1][OÓ]N|V[I1]GENC[I1]A|REGISTRO)/i;
/** Sección electoral */
const SECCION_RE = /^SECCI[OÓ]N/i;
/** Encabezados institucionales */
const INST_HEADER_RE =
  /^(?:INST[I1]TUTO|INE\b|IFE\b|CREDENC[I1]AL|ELECTORAL|NAC[I1]ONAL)/i;
/** Etiquetas de campo INE (no de dirección) */
const FIELD_LABEL_RE =
  /^(?:CURP|CLAVE|SEXO|NOMBRE|APELLIDO|PATERNO|MATERNO)\b/i;
/** Líneas que son solo números cortos (sección, página, etc.) */
const SHORT_NUM_RE = /^\d{1,4}$/;
/** Año suelto */
const YEAR_LINE_RE = /^\d{4}$/;

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE CLASIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determina si una línea es definitivamente NO parte de una dirección.
 * Usa una batería de patrones negativos.
 */
function isDefinitelyNotAddress(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  if (trimmed.length < 2) return true;

  // MRZ
  if (MRZ_RE.test(trimmed)) return true;
  // CURP
  if (CURP_RE.test(trimmed)) return true;
  // Clave de Elector
  if (CLAVE_RE.test(trimmed)) return true;
  // Encabezados institucionales
  if (INST_HEADER_RE.test(trimmed)) return true;
  // Etiquetas de campo INE (CURP:, CLAVE:, SEXO:, etc.)
  if (FIELD_LABEL_RE.test(trimmed)) return true;
  // Fechas / vigencia / emisión
  if (DATE_LABEL_RE.test(trimmed)) return true;
  // Sección electoral
  if (SECCION_RE.test(trimmed)) return true;
  // Solo números cortos (sección, página)
  if (SHORT_NUM_RE.test(trimmed)) return true;
  // Año suelto (2020, 2025, etc.)
  if (YEAR_LINE_RE.test(trimmed)) return true;
  // Inline CURP: "CURP GALJ900101HMCRPN09"
  if (/^CURP\s/i.test(trimmed)) return true;
  // Inline Clave: "CLAVE DE ELECTOR ..."
  if (/^CLAVE\s/i.test(trimmed)) return true;
  // "CREDENCIAL PARA VOTAR"
  if (/CREDENCIAL\s+PARA\s+VOTAR/i.test(trimmed)) return true;
  // Texto que es mayormente < (MRZ parcial)
  if ((trimmed.match(/</g)?.length ?? 0) >= 3) return true;
  // Etiquetas de nombre: "APELLIDO PATERNO", "APELLIDO MATERNO", "NOMBRE(S)"
  if (
    /^(?:A(?:PELLID|PELL[I1]D)[O0]\s+)?(?:PATERN[O0]|MATERN[O0])$/i.test(
      trimmed,
    )
  )
    return true;
  if (/^N[O0]MBRE(?:\([S5]\))?$/i.test(trimmed)) return true;

  return false;
}

/**
 * Detecta si una línea contiene un nombre de estado mexicano.
 * Retorna el estado normalizado si lo encuentra, o null.
 */
function detectState(line: string): string | null {
  const upper = line.trim().toUpperCase();

  // Checar estados completos (más largos primero para "BAJA CALIFORNIA SUR" antes de "BAJA CALIFORNIA")
  const sortedStates = [...MEXICAN_STATES_LIST].sort(
    (a, b) => b.length - a.length,
  );
  for (const state of sortedStates) {
    if (upper.includes(state.toUpperCase())) return state;
  }

  // Checar abreviaciones
  for (const [abbr, full] of Object.entries(STATE_ABBREVIATIONS)) {
    // Para abreviaciones cortas (2-3 chars), exigir que sea palabra completa
    if (abbr.length <= 3) {
      const re = new RegExp(`\\b${abbr.replace(/\./g, "\\.")}\\b`, "i");
      // Evitar "COL" como estado cuando hay "COL." de colonia
      if (abbr === "COL" && /COL\.?\s+\w/i.test(upper)) continue;
      if (re.test(upper)) return full;
    } else {
      if (upper.includes(abbr.toUpperCase())) return full;
    }
  }

  return null;
}

/**
 * Detecta si una línea parece contener información de dirección.
 * Retorna un score 0-1 de cuánto "huele" a dirección.
 */
function addressLineLikelihood(line: string): number {
  const upper = line.trim().toUpperCase();
  let score = 0;

  // Tipo de vialidad al inicio
  if (STREET_TYPE_RE.test(upper)) score += 0.4;
  // Código postal
  if (CP_LABELED_RE.test(upper)) score += 0.5;
  else if (CP_BARE_RE.test(upper) && upper.length > 5) score += 0.2;
  // Colonia
  if (COLONIA_RE.test(upper)) score += 0.4;
  // Municipio
  if (MUNICIPIO_RE.test(upper)) score += 0.3;
  // Estado mexicano
  if (detectState(upper)) score += 0.3;
  // Número exterior (en contexto de texto)
  if (/\d{1,5}/.test(upper) && /[A-Z]{2,}/.test(upper)) score += 0.15;
  // Tiene "SN" (sin número) o "S/N"
  if (/\bS\.?\s*\/?\s*N\.?\b/i.test(upper)) score += 0.2;
  // Keywords de dirección: INT, EXT, MZA, LT, LOTE, MANZANA
  if (/\b(?:INT|EXT|MZA|MANZANA|LT|LOTE|DEPTO|DPTO|EDIF)\b/i.test(upper))
    score += 0.25;

  return Math.min(score, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTRATEGIAS DE EXTRACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

interface AddressCandidate {
  value: string;
  confidence: number;
  method: string;
  lines: string[];
}

/** Limpia una línea individual de domicilio */
function cleanAddressLine(line: string): string {
  return line
    .replace(/^D[O0]M[I1]C[I1]L[I1][O0]\s*/i, "") // quitar label DOMICILIO
    .replace(/[|]/g, "") // pipes de OCR
    .replace(/\s{2,}/g, " ") // espacios múltiples
    .trim();
}

/** Ensambla líneas en dirección legible */
function assembleAddress(lines: string[]): string {
  const cleaned = lines.map(cleanAddressLine).filter((l) => l.length >= 2);
  return cleaned.join(", ");
}

/** Calcula score de confianza basado en patrones detectados */
function scoreAddress(text: string, lineCount: number): number {
  if (!text || text.length < 3) return 0;

  let score = 0.1; // base: hay algo de texto

  // Código postal etiquetado (C.P. XXXXX)
  if (CP_LABELED_RE.test(text)) score += 0.25;
  // Código postal bare (5 dígitos)
  else if (CP_BARE_RE.test(text)) score += 0.15;

  // Número exterior
  if (/\d{1,5}/.test(text) && /[A-ZÁÉÍÓÚÑÜ]{2,}/.test(text)) score += 0.15;

  // Colonia
  if (COLONIA_RE.test(text)) score += 0.15;

  // Estado mexicano
  if (detectState(text)) score += 0.2;

  // Municipio/Delegación
  if (MUNICIPIO_RE.test(text)) score += 0.1;

  // Múltiples líneas (más contenido = más confiable)
  if (lineCount >= 2) score += 0.05;
  if (lineCount >= 3) score += 0.05;

  // Penalidad: si contiene CURP o clave mezclados
  if (CURP_RE.test(text)) score -= 0.2;
  if (CLAVE_RE.test(text)) score -= 0.2;

  return Math.max(0, Math.min(score, 1.0));
}

/**
 * Estrategia A: Ancla directa "DOMICILIO" (mejorada).
 *
 * Busca la etiqueta DOMICILIO con alta tolerancia OCR, incluyendo:
 *   - D0MICILIO, DOM1CILIO, etc.
 *   - "DOMIC" parcial
 *   - DOMICILIO inline ("DOMICILIO CALLE REFORMA 123")
 */
function strategyDomicilioAnchor(lines: string[]): AddressCandidate | null {
  // Buscar ancla con tolerancia OCR extendida
  let domIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase();
    // Match estricto: DOMICILIO completo
    if (/D[O0]M[I1]C[I1]L[I1][O0]/i.test(l)) {
      domIdx = i;
      break;
    }
    // Match parcial: "DOMIC" al inicio (OCR cortó el final)
    if (/^D[O0]M[I1]C/i.test(l) && l.length >= 5) {
      domIdx = i;
      break;
    }
  }

  if (domIdx < 0) return null;

  const collected: string[] = [];

  // ¿La línea ancla tiene valor inline?
  const anchorLine = lines[domIdx];
  const inlineValue = anchorLine
    .replace(/^D[O0]M[I1]C[I1]L[I1][O0]\s*/i, "")
    .trim();
  if (inlineValue.length >= 3 && !DOMICILIO_RE.test(inlineValue)) {
    collected.push(inlineValue);
  }

  // Recolectar hacia adelante, hasta 10 líneas o stop token
  for (let i = domIdx + 1; i < Math.min(domIdx + 11, lines.length); i++) {
    const line = lines[i];
    if (isDefinitelyNotAddress(line)) break;
    if (line.trim().length < 2) continue;
    collected.push(line);
    // El estado mexicano es siempre la línea terminal del domicilio en INE
    if (detectState(line)) break;
  }

  if (collected.length === 0) return null;

  const address = assembleAddress(collected);
  return {
    value: address,
    confidence: scoreAddress(address, collected.length),
    method: "domicilio_anchor",
    lines: collected,
  };
}

/**
 * Estrategia B: Ancla por Código Postal.
 *
 * El C.P. (5 dígitos) es el patrón más confiable en una dirección mexicana.
 * Busca "C.P. XXXXX" o "XXXXX" (5 dígitos aislados) y reconstruye la
 * dirección buscando hacia atrás y adelante.
 */
function strategyPostalCode(lines: string[]): AddressCandidate | null {
  // Buscar línea con C.P. etiquetado (más confiable)
  let cpIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (CP_LABELED_RE.test(lines[i])) {
      cpIdx = i;
      break;
    }
  }

  // Si no hay etiquetado, buscar bare 5 dígitos en línea no-ruidosa
  if (cpIdx < 0) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (
        CP_BARE_RE.test(l) &&
        !isDefinitelyNotAddress(l) &&
        l.length >= 5 &&
        l.length <= 80
      ) {
        // Verificar que los 5 dígitos NO son parte de un CURP o clave
        const stripped = l.replace(CURP_RE, "").replace(CLAVE_RE, "");
        if (CP_BARE_RE.test(stripped)) {
          cpIdx = i;
          break;
        }
      }
    }
  }

  if (cpIdx < 0) return null;

  const collected: string[] = [];

  // Buscar hacia ATRÁS (la calle está antes del C.P.)
  const backwardLines: string[] = [];
  for (let i = cpIdx - 1; i >= Math.max(0, cpIdx - 6); i--) {
    const l = lines[i];
    if (isDefinitelyNotAddress(l)) break;
    if (DOMICILIO_RE.test(l)) {
      // Si es "DOMICILIO CALLE...", incluir solo el valor
      const val = l.replace(DOMICILIO_RE, "").trim();
      if (val.length >= 3) backwardLines.unshift(val);
      break; // Llegamos al encabezado
    }
    if (l.trim().length < 2) continue;
    backwardLines.unshift(l);
  }

  collected.push(...backwardLines);
  collected.push(lines[cpIdx]); // La línea del C.P.

  // Buscar hacia ADELANTE (estado, municipio después del C.P.)
  for (let i = cpIdx + 1; i < Math.min(cpIdx + 4, lines.length); i++) {
    const l = lines[i];
    if (isDefinitelyNotAddress(l)) break;
    if (l.trim().length < 2) continue;
    // Solo incluir si parece dirección (estado, municipio)
    if (addressLineLikelihood(l) >= 0.15 || detectState(l)) {
      collected.push(l);
    } else {
      break;
    }
  }

  if (collected.length === 0) return null;

  const address = assembleAddress(collected);
  return {
    value: address,
    confidence: scoreAddress(address, collected.length),
    method: "postal_code",
    lines: collected,
  };
}

/**
 * Estrategia C: Ancla por estado mexicano.
 *
 * Si encontramos un nombre de estado, la dirección termina ahí.
 * Reconstruimos hacia atrás.
 */
function strategyStateName(lines: string[]): AddressCandidate | null {
  let stateIdx = -1;

  // Buscar de abajo hacia arriba (el estado suele estar al final de la dirección)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isDefinitelyNotAddress(lines[i])) continue;
    const st = detectState(lines[i]);
    if (st) {
      stateIdx = i;
      break;
    }
  }

  if (stateIdx < 0) return null;

  const collected: string[] = [];

  // Hacia atrás desde el estado
  for (let i = stateIdx; i >= Math.max(0, stateIdx - 7); i--) {
    const l = lines[i];
    if (i < stateIdx && isDefinitelyNotAddress(l)) break;
    if (DOMICILIO_RE.test(l)) {
      const val = l.replace(DOMICILIO_RE, "").trim();
      if (val.length >= 3) collected.unshift(val);
      break;
    }
    if (l.trim().length < 2 && i < stateIdx) continue;
    collected.unshift(l);
  }

  if (collected.length === 0) return null;

  const address = assembleAddress(collected);
  // Bonus: sabemos que detectamos un estado
  const score = Math.min(scoreAddress(address, collected.length) + 0.05, 1.0);
  return {
    value: address,
    confidence: score,
    method: "state_name",
    lines: collected,
  };
}

/**
 * Estrategia D: Ancla por colonia.
 *
 * "COL.", "COLONIA", "FRACC." son patrones muy reconocibles.
 * La calle suele estar 1-2 líneas arriba, el C.P. y estado abajo.
 */
function strategyColonia(lines: string[]): AddressCandidate | null {
  let colIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (COLONIA_RE.test(lines[i]) && !isDefinitelyNotAddress(lines[i])) {
      colIdx = i;
      break;
    }
  }

  if (colIdx < 0) return null;

  const collected: string[] = [];

  // Hacia atrás: buscar la calle (1-4 líneas antes de la colonia)
  for (let i = colIdx - 1; i >= Math.max(0, colIdx - 4); i--) {
    const l = lines[i];
    if (isDefinitelyNotAddress(l)) break;
    if (DOMICILIO_RE.test(l)) {
      const val = l.replace(DOMICILIO_RE, "").trim();
      if (val.length >= 3) collected.unshift(val);
      break;
    }
    if (l.trim().length < 2) continue;
    collected.unshift(l);
  }

  // La colonia misma
  collected.push(lines[colIdx]);

  // Hacia adelante: C.P., municipio, estado
  for (let i = colIdx + 1; i < Math.min(colIdx + 5, lines.length); i++) {
    const l = lines[i];
    if (isDefinitelyNotAddress(l)) break;
    if (l.trim().length < 2) continue;
    collected.push(l);
    // El estado mexicano es siempre la línea terminal del domicilio en INE
    if (detectState(l)) break;
  }

  if (collected.length === 0) return null;

  const address = assembleAddress(collected);
  return {
    value: address,
    confidence: scoreAddress(address, collected.length),
    method: "colonia",
    lines: collected,
  };
}

/**
 * Estrategia E: Filtrado negativo (último recurso).
 *
 * Toma TODAS las líneas del reverso, elimina lo que definitivamente NO es
 * dirección (CURP, clave, MRZ, fechas, encabezados…).
 * Lo que queda es —probablemente— la dirección.
 *
 * Esta es la estrategia más robusta ante OCR degradado donde las etiquetas
 * están irreconocibles, porque no necesita encontrar "DOMICILIO" ni "C.P."
 * sino que se apoya en saber qué NO es dirección.
 */
function strategyNegativeFilter(lines: string[]): AddressCandidate | null {
  const survivors: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;

    // Filtro negativo: quitar todo lo que sabemos que NO es dirección
    if (isDefinitelyNotAddress(trimmed)) continue;

    // Filtro adicional: líneas que son SOLO etiqueta "DOMICILIO" sin valor
    if (/^D[O0]M[I1]C[I1]L[I1][O0]$/i.test(trimmed)) continue;

    // Filtro: líneas que parecen nombres de persona (no dirección)
    // (1+ palabras de letras puras sin números y sin keywords de dirección)
    // Solo si la línea NO tiene ningún indicador de dirección.
    const isNameLike =
      /^[A-ZÁÉÍÓÚÑÜ]{2,}(\s+[A-ZÁÉÍÓÚÑÜ]{2,}){0,2}$/.test(trimmed) &&
      addressLineLikelihood(trimmed) < 0.1 &&
      !detectState(trimmed);
    if (isNameLike) {
      continue;
    }

    survivors.push(trimmed);
  }

  if (survivors.length === 0) return null;

  // Estimar qué subset de supervivientes es dirección usando scoring
  // Tomar la secuencia contigua con mayor score acumulado
  let bestStart = 0;
  let bestEnd = survivors.length;
  let bestScore = 0;

  for (let start = 0; start < survivors.length; start++) {
    for (
      let end = start + 1;
      end <= Math.min(start + 8, survivors.length);
      end++
    ) {
      const subset = survivors.slice(start, end);
      const combined = subset.join(", ");
      const s = scoreAddress(combined, subset.length);
      if (s > bestScore) {
        bestScore = s;
        bestStart = start;
        bestEnd = end;
      }
    }
  }

  const bestLines = survivors.slice(bestStart, bestEnd);
  const address = assembleAddress(bestLines);

  if (!address || address.length < 5) return null;

  // El filtrado negativo tiene penalty base de confianza
  const score = Math.max(scoreAddress(address, bestLines.length) - 0.05, 0.15);
  return {
    value: address,
    confidence: score,
    method: "negative_filter",
    lines: bestLines,
  };
}

/**
 * Estrategia F: Tipo de vialidad al inicio de línea.
 *
 * Si encontramos "CALLE", "AV.", "AVENIDA", "BLVD", etc. al inicio de una línea,
 * es muy probable que sea el inicio de la dirección. Recolectar hacia adelante.
 */
function strategyStreetType(lines: string[]): AddressCandidate | null {
  let streetIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (STREET_TYPE_RE.test(lines[i]) && !isDefinitelyNotAddress(lines[i])) {
      streetIdx = i;
      break;
    }
  }

  if (streetIdx < 0) return null;

  const collected: string[] = [lines[streetIdx]];

  // Hacia adelante
  for (let i = streetIdx + 1; i < Math.min(streetIdx + 8, lines.length); i++) {
    const l = lines[i];
    if (isDefinitelyNotAddress(l)) break;
    if (l.trim().length < 2) continue;
    collected.push(l);
    // El estado mexicano es siempre la línea terminal del domicilio en INE
    if (detectState(l)) break;
  }

  const address = assembleAddress(collected);
  return {
    value: address,
    confidence: scoreAddress(address, collected.length),
    method: "street_type",
    lines: collected,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: ORQUESTADOR DE ESTRATEGIAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extrae el domicilio del reverso de la INE usando múltiples estrategias.
 *
 * Ejecuta todas las estrategias en paralelo, puntúa cada resultado,
 * y devuelve el candidato con mayor confianza.
 *
 * @param backLines - Líneas del texto OCR del reverso de la INE
 * @returns Dirección extraída con confianza y método usado
 */
export function extractDomicilioExpert(backLines: string[]): {
  value: string;
  confidence: number;
  method: string;
} {
  if (backLines.length === 0)
    return { value: "", confidence: 0, method: "none" };

  // Ejecutar todas las estrategias
  const candidates: (AddressCandidate | null)[] = [
    strategyDomicilioAnchor(backLines), // A: "DOMICILIO" label
    strategyPostalCode(backLines), // B: C.P. XXXXX
    strategyStateName(backLines), // C: Nombre de estado
    strategyColonia(backLines), // D: COL./COLONIA
    strategyStreetType(backLines), // F: CALLE/AV/BLVD
    strategyNegativeFilter(backLines), // E: Último recurso
  ];

  // Filtrar nulos y ordenar por confianza descendente
  const valid = candidates
    .filter((c): c is AddressCandidate => c !== null && c.value.length >= 3)
    .sort((a, b) => b.confidence - a.confidence);

  if (valid.length === 0) {
    return { value: "", confidence: 0, method: "none" };
  }

  const best = valid[0];

  // Si el mejor tiene baja confianza pero hay otro con más líneas, considerar fusión
  if (valid.length >= 2 && best.confidence < 0.5) {
    const second = valid[1];
    // Si el segundo tiene contenido diferente y complementario, fusionar
    const bestUpper = best.value.toUpperCase();
    const secondUpper = second.value.toUpperCase();
    if (
      !bestUpper.includes(secondUpper) &&
      !secondUpper.includes(bestUpper) &&
      second.confidence >= 0.2
    ) {
      // Fusionar: combinar líneas únicas de ambos
      const merged = [...best.lines];
      for (const line of second.lines) {
        if (!merged.some((m) => m.toUpperCase() === line.toUpperCase())) {
          merged.push(line);
        }
      }
      const mergedAddress = assembleAddress(merged);
      const mergedScore = scoreAddress(mergedAddress, merged.length);
      if (mergedScore > best.confidence) {
        return {
          value: mergedAddress,
          confidence: mergedScore,
          method: `${best.method}+${second.method}`,
        };
      }
    }
  }

  return {
    value: best.value,
    confidence: best.confidence,
    method: best.method,
  };
}

/**
 * Extrae dirección de bloques espaciales (versión mejorada).
 *
 * Recibe bloques ya clasificados en la zona de dirección (del frente
 * o del reverso) y aplica las mismas heurísticas de filtrado y scoring.
 */
export function extractAddressFromSpatialExpert(
  addressBlocks: {
    text: string;
    lines: { text: string; confidence?: number }[];
  }[],
): { value: string; confidence: number; method: string } {
  if (addressBlocks.length === 0) {
    return { value: "", confidence: 0, method: "none" };
  }

  // Ensamblar líneas de los bloques espaciales
  const spatialLines: string[] = [];
  for (const block of addressBlocks) {
    for (const line of block.lines) {
      const text = line.text.trim();
      if (text.length >= 2) {
        spatialLines.push(text.toUpperCase());
      }
    }
  }

  if (spatialLines.length === 0) {
    // Fallback: usar el text del bloque directamente
    for (const block of addressBlocks) {
      const text = block.text.trim();
      if (text.length >= 2) {
        for (const subline of text.split("\n")) {
          if (subline.trim().length >= 2) {
            spatialLines.push(subline.trim().toUpperCase());
          }
        }
      }
    }
  }

  if (spatialLines.length === 0) {
    return { value: "", confidence: 0, method: "none" };
  }

  // Aplicar el orquestador de estrategias a las líneas espaciales
  const result = extractDomicilioExpert(spatialLines);

  // Bonus por tener dato espacial (sabemos que estamos buscando en la zona correcta)
  const boostedConfidence = Math.min(result.confidence + 0.1, 1.0);

  return {
    value: result.value,
    confidence: result.value ? boostedConfidence : 0,
    method: `spatial_${result.method}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESGLOSE DE DOMICILIO EN SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Representa los sub-componentes estructurados de un domicilio mexicano.
 * Todos los campos son strings normalizados a mayúsculas.
 * Los campos no detectados quedarán como cadena vacía "".
 */
export interface ParsedAddress {
  /** Calle y número: "CALLE REFORMA 123 INT 4" */
  calle: string;
  /** Colonia / fraccionamiento (sin el prefijo COL./COLONIA): "CENTRO" */
  colonia: string;
  /** Código postal de 5 dígitos: "06600" */
  codigoPostal: string;
  /** Municipio, delegación o alcaldía: "CUAUHTÉMOC" */
  municipio: string;
  /** Estado de México (normalizado): "CIUDAD DE MEXICO" */
  estado: string;
}

/**
 * Desglosa un string de domicilio ensamblado en sus sub-componentes.
 *
 * La cadena de entrada es el resultado de `assembleAddress()`, con partes
 * separadas por comas. Por ejemplo:
 *   "CALLE REFORMA 123, COL. CENTRO, C.P. 06000 CUAUHTÉMOC, CIUDAD DE MEXICO"
 *
 * Usa los mismos patrones y detectores que las estrategias de extracción
 * para identificar cada componente sin depender de orden fijo.
 *
 * @param domicilio String de domicilio ensamblado (o texto multilines con \n)
 * @returns ParsedAddress con los sub-campos detectados; vacíos si no se detectan
 */
export function parseAddressComponents(domicilio: string): ParsedAddress {
  const result: ParsedAddress = {
    calle: "",
    colonia: "",
    codigoPostal: "",
    municipio: "",
    estado: "",
  };

  if (!domicilio.trim()) return result;

  // Normalizar a uppercase NFC
  const upper = domicilio.trim().toUpperCase().normalize("NFC");

  // Dividir por coma o salto de línea
  const parts = upper
    .split(/,|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  if (parts.length === 0) return result;

  const used = new Set<number>();
  let statePartIndex = -1;

  // 1. Estado — buscar desde el final (el estado siempre cierra una dirección)
  for (let i = parts.length - 1; i >= 0; i--) {
    const state = detectState(parts[i]);
    if (state) {
      result.estado = state;
      statePartIndex = i;
      used.add(i);
      break;
    }
  }

  // 2. Código Postal — preferir el form etiquetado "C.P. XXXXX"
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].match(CP_LABELED_RE);
    if (m) {
      result.codigoPostal = m[1];
      break;
    }
  }
  if (!result.codigoPostal) {
    for (let i = 0; i < parts.length; i++) {
      const m = parts[i].match(CP_BARE_RE);
      if (m) {
        result.codigoPostal = m[1];
        break;
      }
    }
  }

  // 3. Colonia — parte con prefijo COL./COLONIA/FRACC./etc.
  for (let i = 0; i < parts.length; i++) {
    if (COLONIA_RE.test(parts[i])) {
      // Eliminar el prefijo de colonia para dejar solo el nombre
      result.colonia = parts[i]
        .replace(COLONIA_RE, "")
        .replace(CP_LABELED_RE, "")
        .replace(CP_BARE_RE, "")
        .trim();
      used.add(i);
      break;
    }
  }

  // 4. Municipio — parte con prefijo MUNICIPIO/DELEGACION/ALCALDIA
  for (let i = 0; i < parts.length; i++) {
    if (MUNICIPIO_RE.test(parts[i])) {
      result.municipio = parts[i]
        .replace(MUNICIPIO_RE, "")
        .replace(CP_LABELED_RE, "")
        .replace(CP_BARE_RE, "")
        .trim();
      used.add(i);
      break;
    }
  }

  // 4b. Municipio — fallback: texto después del C.P. en la misma parte
  if (!result.municipio && result.codigoPostal) {
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes(result.codigoPostal)) {
        const afterCp = parts[i]
          .replace(new RegExp(`.*\\b${result.codigoPostal}\\b\\s*`), "")
          .replace(MUNICIPIO_RE, "")
          .trim();
        // Solo tomar si no es el estado y tiene contenido
        if (
          afterCp.length >= 2 &&
          !detectState(afterCp) &&
          !COLONIA_RE.test(afterCp)
        ) {
          result.municipio = afterCp;
        }
        break;
      }
    }
  }

  // 4c. Municipio + estado juntos: "PUEBLA, PUE." or "PUEBLA PUE.".
  // First token is municipality; state abbreviation/full name is state.
  if (!result.municipio && result.estado && statePartIndex >= 0) {
    const statePart = parts[statePartIndex];
    const previousPart = statePartIndex > 0 ? parts[statePartIndex - 1] : "";
    const statePrefix = result.estado.split(" ")[0];
    const sameLineMunicipio = statePart
      .replace(CP_LABELED_RE, "")
      .replace(CP_BARE_RE, "")
      .replace(
        /\b(?:AGS|BCS?|CAMP|CHIS|CHIH|CDMX|DF|COAH|COL|DGO|GTO|GRO|HGO|JAL|MICH|MOR|NAY|NL|OAX|PUE|QROO?|SLP|SIN|SON|TAB|TAMPS|TLAX|VER|YUC|ZAC)\.?\b/gi,
        "",
      )
      .replace(
        new RegExp(`\\b${result.estado.replace(/\s+/g, "\\s+")}\\b`, "i"),
        "",
      )
      .trim();

    if (
      sameLineMunicipio.length >= 2 &&
      /[A-ZÁÉÍÓÚÑÜ]/.test(sameLineMunicipio)
    ) {
      result.municipio = sameLineMunicipio;
    } else if (
      previousPart.length >= 2 &&
      /^[A-ZÁÉÍÓÚÑÜ\s.]+$/.test(previousPart) &&
      !COLONIA_RE.test(previousPart) &&
      !STREET_TYPE_RE.test(previousPart)
    ) {
      result.municipio = previousPart.replace(/\.$/, "").trim();
    } else if (!result.municipio && result.estado === statePrefix) {
      result.municipio = result.estado;
    }
  }

  // 5. Calle — primera parte sin usar que tenga vialidad o score de dirección
  for (let i = 0; i < parts.length; i++) {
    if (used.has(i)) continue;
    const part = parts[i];
    // Descartar si es solo un CP de 5 dígitos o es el estado detectado
    if (/^\d{5}$/.test(part)) continue;
    if (detectState(part) && part.length < 25) continue;
    // Evaluar si parece calle
    if (
      STREET_TYPE_RE.test(part) ||
      (addressLineLikelihood(part) > 0.25 && !COLONIA_RE.test(part))
    ) {
      result.calle = part;
      used.add(i);
      break;
    }
  }

  // 5b. Calle — fallback: primera parte no usada que no sea claramente otra cosa
  if (!result.calle) {
    for (let i = 0; i < parts.length; i++) {
      if (used.has(i)) continue;
      if (/^\d{5}$/.test(parts[i])) continue;
      if (detectState(parts[i]) && parts[i].length < 25) continue;
      result.calle = parts[i];
      break;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS PARA TESTING / INTROSPECCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

export {
  addressLineLikelihood,
  detectState,
  isDefinitelyNotAddress,
  MEXICAN_STATES_LIST,
  scoreAddress,
};
