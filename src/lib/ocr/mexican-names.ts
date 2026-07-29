/**
 * 🇲🇽 Diccionario de nombres mexicanos
 * =====================================
 * Top ~200 nombres y ~200 apellidos más frecuentes en México (INEGI/RENAPO).
 * Usado para:
 *  1. Validar que un texto OCR extraído sea realmente un nombre/apellido
 *  2. Corregir errores OCR comunes en nombres (GARC1A → GARCIA, MART1NEZ → MARTINEZ)
 *  3. Desambiguar entre nombre y apellido cuando solo hay un candidato
 *
 * Las listas están en mayúsculas (el OCR normaliza a mayúsculas) y se almacenan
 * en Sets para búsqueda O(1).
 */

// ── Apellidos más comunes en México (INEGI) ─────────────────────────────────

export const APELLIDOS_COMUNES = new Set([
  // Top 100+ apellidos por frecuencia
  "HERNANDEZ",
  "GARCIA",
  "MARTINEZ",
  "LOPEZ",
  "GONZALEZ",
  "RODRIGUEZ",
  "PEREZ",
  "SANCHEZ",
  "RAMIREZ",
  "CRUZ",
  "FLORES",
  "GOMEZ",
  "MORALES",
  "VAZQUEZ",
  "JIMENEZ",
  "REYES",
  "DIAZ",
  "TORRES",
  "GUTIERREZ",
  "RUIZ",
  "MENDOZA",
  "AGUILAR",
  "MORENO",
  "CASTILLO",
  "ROMERO",
  "ALVAREZ",
  "ORTIZ",
  "JUAREZ",
  "SANTIAGO",
  "HERRERA",
  "MEDINA",
  "CASTRO",
  "GUZMAN",
  "VARGAS",
  "VELAZQUEZ",
  "RAMOS",
  "CONTRERAS",
  "DOMINGUEZ",
  "GUERRERO",
  "LARA",
  "SANTOS",
  "BAUTISTA",
  "LUNA",
  "SALAZAR",
  "CHAVEZ",
  "SILVA",
  "NUÑEZ",
  "NUNEZ",
  "RIOS",
  "ROJAS",
  "DELGADO",
  "DE LA CRUZ",
  "SOTO",
  "VEGA",
  "FERNANDEZ",
  "LEON",
  "AVILA",
  "MEJIA",
  "ESPINOZA",
  "CERVANTES",
  "RIVERA",
  "CAMPOS",
  "ALVARADO",
  "PADILLA",
  "CORTEZ",
  "CORTES",
  "SANDOVAL",
  "FIGUEROA",
  "IBARRA",
  "ESTRADA",
  "CAMACHO",
  "BRAVO",
  "GALLEGOS",
  "ACOSTA",
  "VALDEZ",
  "VALDES",
  "CABRERA",
  "MORA",
  "NAVA",
  "NAVARRO",
  "PACHECO",
  "OLVERA",
  "FUENTES",
  "TREJO",
  "SOLIS",
  "SALINAS",
  "CARDENAS",
  "OROZCO",
  "ROSALES",
  "SERRANO",
  "TAPIA",
  "MEZA",
  "VERA",
  "BECERRA",
  "MARQUEZ",
  "PALACIOS",
  "CALDERON",
  "VILLEGAS",
  "AYALA",
  "VELASCO",
  "CORONA",
  "ARELLANO",
  "MALDONADO",
  "CARRILLO",
  "ZUÑIGA",
  "ZUNIGA",
  "MAYA",
  "DURAN",
  "ESPINOSA",
  "PONCE",
  "CISNEROS",
  "OCHOA",
  "PINEDA",
  "LEAL",
  "ROBLES",
  "HUERTA",
  "AGUIRRE",
  "GARZA",
  "BARRERA",
  "MONTOYA",
  "MONTES",
  "RUBIO",
  "BERNAL",
  "FRANCO",
  "BARAJAS",
  "VILLANUEVA",
  "SUAREZ",
  "ZAVALA",
  "RANGEL",
  "ESCOBAR",
  "ZARATE",
  "MACIAS",
  "VILLAGOMEZ",
  "ARROYO",
  "LEYVA",
  "MARIN",
  "ALONSO",
  "ZAPATA",
  "MURILLO",
  "GALINDO",
  "BELTRAN",
  "OSORIO",
  "CASTAÑEDA",
  "CASTANEDA",
  "ZAMORA",
  "BALDERAS",
  "CANO",
  "RICO",
  "ENRIQUEZ",
  "MOLINA",
  "CARBAJAL",
  "CUEVAS",
  "ANDRADE",
  "VILLARREAL",
  "CORTEZ",
  "MUNOZ",
  "MUÑOZ",
  "PAREDES",
  "PEÑA",
  "PENA",
  "TRINIDAD",
  "CORONADO",
  "MAGAÑA",
  "MAGANA",
  "OLIVA",
  "OLIVAS",
  "CABALLERO",
  "BUSTAMANTE",
  "SOLANO",
  "NAJERA",
  "DE LEON",
  "DE JESUS",
  "BARRIOS",
  "ESQUIVEL",
  "PALMA",
  "ROSAS",
  "FELIX",
  "MIRANDA",
  "MERCADO",
  "QUINTERO",
  "ALARCON",
  "PERALTA",
  "GARIBAY",
  "ROJO",
  "TELLEZ",
  "YAÑEZ",
  "YANEZ",
  "MATA",
  "BECERRIL",
  "VERGARA",
  "ALCALA",
  "TOVAR",
  "CARMONA",
  "PANTOJA",
  "SAAVEDRA",
  "CENTENO",
  "SORIANO",
  "GUILLEN",
  "ALEMAN",
  "ARANDA",
]);

// ── Nombres propios más comunes (hombres + mujeres) ─────────────────────────

export const NOMBRES_COMUNES = new Set([
  // Hombres
  "JOSE",
  "JUAN",
  "LUIS",
  "CARLOS",
  "MIGUEL",
  "ANGEL",
  "FRANCISCO",
  "JESUS",
  "ANTONIO",
  "PEDRO",
  "ALEJANDRO",
  "JORGE",
  "SERGIO",
  "FERNANDO",
  "RICARDO",
  "DANIEL",
  "RAFAEL",
  "MANUEL",
  "MARIO",
  "ROBERTO",
  "DAVID",
  "EDUARDO",
  "ARTURO",
  "ENRIQUE",
  "JAVIER",
  "ALBERTO",
  "OSCAR",
  "RAUL",
  "MARCO",
  "MARCOS",
  "VICTOR",
  "HUGO",
  "MARTIN",
  "RAMON",
  "GABRIEL",
  "HECTOR",
  "GUSTAVO",
  "GUILLERMO",
  "ALFREDO",
  "ANDRES",
  "PABLO",
  "GERARDO",
  "CESAR",
  "ARMANDO",
  "ADRIAN",
  "FELIPE",
  "RUBEN",
  "SANTIAGO",
  "OMAR",
  "EDGAR",
  "IVAN",
  "IGNACIO",
  "JAIME",
  "SAMUEL",
  "RODRIGO",
  "DIEGO",
  "ERNESTO",
  "ROGELIO",
  "ALDO",
  "JULIO",
  "SAUL",
  "LEONARDO",
  "GILBERTO",
  "JONATHAN",
  "CHRISTIAN",
  "ISRAEL",
  "SALVADOR",
  "ISMAEL",
  "ABEL",
  "EMILIO",
  "AARON",
  "TOMAS",
  "BENJAMIN",
  "ALAN",
  "AXEL",
  "ULISES",
  "LEONEL",
  "ALEXIS",
  "ALONSO",
  "ESTEBAN",
  "NOEL",
  "MOISES",
  "JOEL",
  "MISAEL",
  "URIEL",
  "KEVIN",
  "BRANDON",
  "BRYAN",
  "GIOVANNI",
  "CRISTIAN",
  "EMMANUEL",
  "ERICK",
  "ERIK",
  "ABRAHAM",
  "ISAAC",
  "EFRAIN",
  // Mujeres
  "MARIA",
  "GUADALUPE",
  "MARGARITA",
  "JOSEFINA",
  "PATRICIA",
  "ROSA",
  "ELIZABETH",
  "TERESA",
  "ANA",
  "ALEJANDRA",
  "ADRIANA",
  "DIANA",
  "CLAUDIA",
  "LAURA",
  "LETICIA",
  "SILVIA",
  "MARTHA",
  "ALICIA",
  "VERONICA",
  "NORMA",
  "MONICA",
  "GABRIELA",
  "SANDRA",
  "IRMA",
  "CARMEN",
  "BEATRIZ",
  "ELENA",
  "ISABEL",
  "YOLANDA",
  "ROCIO",
  "GRACIELA",
  "LUCIA",
  "ANGELICA",
  "ESTHER",
  "GLORIA",
  "BLANCA",
  "CECILIA",
  "JUANA",
  "ELSA",
  "MARISOL",
  "ESPERANZA",
  "LOURDES",
  "ARACELI",
  "KARLA",
  "JESSICA",
  "ERIKA",
  "LIZBETH",
  "AMPARO",
  "DOLORES",
  "SOLEDAD",
  "CRISTINA",
  "VIRIDIANA",
  "NAYELI",
  "FERNANDA",
  "DULCE",
  "ITZEL",
  "FATIMA",
  "PAOLA",
  "BRENDA",
  "DANIELA",
  "VANESSA",
  "CAROLINA",
  "VALERIA",
  "NATALIA",
  "XIMENA",
  "SOFIA",
  "CAMILA",
  "RENATA",
  "VALENTINA",
  "REGINA",
  "ANDREA",
  "JIMENA",
  "LUCIANA",
  "FRIDA",
  "MIRANDA",
]);

// ── Nombre compuesto frecuente (se buscan como bloque) ──────────────────────
// "JOSE LUIS", "MARIA GUADALUPE", etc.
export const NOMBRES_COMPUESTOS = new Set([
  "JOSE LUIS",
  "JOSE ANTONIO",
  "JOSE MANUEL",
  "JOSE ANGEL",
  "JOSE FRANCISCO",
  "JOSE GUADALUPE",
  "JOSE ALFREDO",
  "JOSE ALBERTO",
  "JOSE MIGUEL",
  "JOSE CARLOS",
  "JOSE RAMON",
  "JOSE ALEJANDRO",
  "JOSE EDUARDO",
  "JOSE MARIA",
  "JOSE DE JESUS",
  "JOSE MARTIN",
  "JUAN CARLOS",
  "JUAN ANTONIO",
  "JUAN MANUEL",
  "JUAN JOSE",
  "JUAN PABLO",
  "JUAN DANIEL",
  "JUAN LUIS",
  "LUIS ANGEL",
  "LUIS ALBERTO",
  "LUIS ENRIQUE",
  "LUIS FERNANDO",
  "LUIS ANTONIO",
  "LUIS MIGUEL",
  "MIGUEL ANGEL",
  "MARCO ANTONIO",
  "CARLOS ALBERTO",
  "CARLOS EDUARDO",
  "MARIA GUADALUPE",
  "MARIA FERNANDA",
  "MARIA ELENA",
  "MARIA ELENA",
  "MARIA DEL CARMEN",
  "MARIA TERESA",
  "MARIA ELENA",
  "MARIA LUISA",
  "MARIA DEL ROSARIO",
  "MARIA ISABEL",
  "MARIA JOSE",
  "MARIA DE LOS ANGELES",
  "MARIA DE JESUS",
  "MARIA DOLORES",
  "MARIA EUGENIA",
  "MARIA ALEJANDRA",
  "MARIA DEL PILAR",
  "MARIA SOLEDAD",
  "ANA MARIA",
  "ANA LAURA",
  "ANA KAREN",
  "ANA PATRICIA",
  "ROSA MARIA",
  "ROSA ISELA",
]);

// ── Correcciones OCR comunes para nombres ───────────────────────────────────
/**
 * Mapa de confusiones OCR frecuentes en nombres mexicanos.
 * Clave: fragmento erróneo (como lo lee el OCR)
 * Valor: corrección correcta
 *
 * Se aplica como reemplazo de substring, no de palabra completa,
 * para cubrir casos como "MART1NEZ" → "MARTINEZ".
 */
export const NOMBRE_OCR_FIXES: [RegExp, string][] = [
  // Dígitos confundidos con letras
  [/1(?=[A-Z])/g, "I"], // MART1NEZ → MARTINEZ
  [/(?<=[A-Z])1/g, "I"], // HER1ANDEZ (raro pero posible)
  [/0(?=[A-Z])/g, "O"], // G0NZALEZ → GONZALEZ
  [/(?<=[A-Z])0/g, "O"], // MOREN0 → MORENO
  [/5(?=[A-Z])/g, "S"], // 5ANCHEZ → SANCHEZ
  [/(?<=[A-Z])5/g, "S"], // VELA5QUEZ → VELASQUEZ
  [/8(?=[A-Z])/g, "B"], // 8AUTISTA → BAUTISTA
  [/(?<=[A-Z])8/g, "B"], // CA8RERA → CABRERA
  [/2(?=[A-Z])/g, "Z"], // 2AMORA → ZAMORA
  [/(?<=[A-Z])2/g, "Z"], // GONZA2EZ → GONZALEZ (raro)
];

// ── Funciones de utilería ───────────────────────────────────────────────────

/**
 * Aplica correcciones OCR a un string de nombre.
 * Primero intenta las correcciones de dígito→letra, luego verifica
 * si el resultado está en el diccionario.
 */
export function fixNameOcr(raw: string): string {
  let fixed = raw;
  for (const [pattern, replacement] of NOMBRE_OCR_FIXES) {
    fixed = fixed.replace(pattern, replacement);
  }
  return fixed;
}

/**
 * Evalúa si un texto parece ser un nombre propio mexicano.
 * Retorna un score 0–1 basado en:
 *  - Coincidencia en diccionario de nombres → 1.0
 *  - Coincidencia en diccionario de apellidos → 0.9 (puede ser usado como nombre)
 *  - Solo letras mayúsculas sin dígitos, len 3-30 → 0.5
 *  - Contiene dígitos o caracteres raros → 0.1
 */
export function scoreAsNombre(text: string): number {
  const clean = text.trim().toUpperCase();
  if (!clean) return 0;

  // Nombre completo compuesto
  if (NOMBRES_COMPUESTOS.has(clean)) return 1.0;

  // Verificar cada palabra
  const words = clean.split(/\s+/);
  let totalScore = 0;
  for (const w of words) {
    const fixed = fixNameOcr(w);
    if (NOMBRES_COMUNES.has(fixed)) totalScore += 1.0;
    else if (APELLIDOS_COMUNES.has(fixed))
      totalScore += 0.6; // apellido como nombre es raro pero posible
    else if (/^[A-ZÁÉÍÓÚÑÜ]{2,}$/.test(fixed)) totalScore += 0.4;
    else totalScore += 0.1;
  }
  return Math.min(totalScore / words.length, 1.0);
}

/**
 * Evalúa si un texto parece ser un apellido mexicano.
 * Retorna un score 0–1.
 */
export function scoreAsApellido(text: string): number {
  const clean = text.trim().toUpperCase();
  if (!clean) return 0;

  const words = clean.split(/\s+/);
  // Apellidos compuestos: "DE LA CRUZ", "DE LEON", "DE JESUS"
  if (APELLIDOS_COMUNES.has(clean) || APELLIDOS_COMUNES.has(words.join(" "))) {
    return 1.0;
  }

  let totalScore = 0;
  for (const w of words) {
    const fixed = fixNameOcr(w);
    if (APELLIDOS_COMUNES.has(fixed)) totalScore += 1.0;
    else if (NOMBRES_COMUNES.has(fixed))
      totalScore += 0.3; // nombre como apellido es posible pero raro
    else if (/^[A-ZÁÉÍÓÚÑÜ]{2,}$/.test(fixed)) totalScore += 0.4;
    else if (/^(DE|DEL|LA|LOS|LAS)$/i.test(w))
      totalScore += 0.8; // partículas de apellido
    else totalScore += 0.1;
  }
  return Math.min(totalScore / words.length, 1.0);
}

/**
 * Intenta corregir un nombre/apellido OCR usando el diccionario.
 * Si el texto con correcciones OCR coincide con un nombre/apellido conocido,
 * devuelve la versión corregida. Si no, devuelve el original.
 */
export function correctNameFromDictionary(raw: string): string {
  const fixed = fixNameOcr(raw.trim().toUpperCase());

  // Si ya es un nombre/apellido conocido, devolverlo
  if (NOMBRES_COMUNES.has(fixed) || APELLIDOS_COMUNES.has(fixed)) {
    return fixed;
  }

  // Intentar coincidencia parcial: Levenshtein distance ≤ 1
  // (un carácter de diferencia)
  const candidates = [
    ...Array.from(APELLIDOS_COMUNES),
    ...Array.from(NOMBRES_COMUNES),
  ];
  for (const candidate of candidates) {
    if (candidate.length === fixed.length && levenshtein1(fixed, candidate)) {
      return candidate;
    }
  }

  // Para nombres largos (>6 chars), intentar Levenshtein distance ≤ 2
  // (dos caracteres de diferencia — cubre errores OCR dobles como "HERN4NDEZ")
  if (fixed.length > 6) {
    for (const candidate of candidates) {
      if (
        Math.abs(candidate.length - fixed.length) <= 1 &&
        levenshteinN(fixed, candidate) <= 2
      ) {
        return candidate;
      }
    }
  }

  return raw.trim().toUpperCase();
}

/** Verifica si dos strings difieren en exactamente 1 carácter (misma longitud) */
function levenshtein1(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

/**
 * Calcula la distancia de Levenshtein exacta entre dos strings.
 * Usa programación dinámica con una sola fila para O(min(m,n)) espacio.
 * Se usa para nombres largos donde Levenshtein-1 es demasiado estricto.
 */
function levenshteinN(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimización: usar el string más corto como columna
  if (a.length > b.length) [a, b] = [b, a];

  const row = Array.from({ length: a.length + 1 }, (_, i) => i);

  for (let j = 1; j <= b.length; j++) {
    let prev = row[0];
    row[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const curr = row[i];
      row[i] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[i], row[i - 1]);
      prev = curr;
    }
  }

  return row[a.length];
}

/**
 * Verifica si las iniciales de un nombre coinciden con las posiciones del CURP.
 * CURP[0] = primera letra ap. paterno (primera vocal interna → no, es la primera letra)
 * CURP[1] = primera vocal interna ap. paterno
 * CURP[2] = primera letra ap. materno
 * CURP[3] = primera letra del nombre
 *
 * Retorna un objeto indicando qué coincidencias se encontraron.
 */
export function matchCurpInitials(
  curp: string,
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
): {
  paternoMatch: boolean;
  maternoMatch: boolean;
  nombreMatch: boolean;
  score: number;
} {
  if (curp.length < 4) {
    return {
      paternoMatch: false,
      maternoMatch: false,
      nombreMatch: false,
      score: 0,
    };
  }

  const c0 = curp[0]; // Primera letra ap. paterno
  const c1 = curp[1]; // Primera vocal interna ap. paterno
  const c2 = curp[2]; // Primera letra ap. materno
  const c3 = curp[3]; // Primera letra nombre

  const ap = apellidoPaterno.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "");
  const am = apellidoMaterno.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "");
  const nm = nombre.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "");

  const paternoMatch = ap.length > 0 && ap[0] === c0;
  // Verificar vocal interna del ap. paterno
  const vowels = ap.slice(1).match(/[AEIOU]/);
  const paternoVowelMatch = vowels ? vowels[0] === c1 : false;

  const maternoMatch = am.length > 0 && am[0] === c2;
  const nombreMatch = nm.length > 0 && nm[0] === c3;

  let score = 0;
  let checks = 0;
  if (ap.length > 0) {
    checks++;
    if (paternoMatch) score++;
  }
  if (ap.length > 1) {
    checks++;
    if (paternoVowelMatch) score++;
  }
  if (am.length > 0) {
    checks++;
    if (maternoMatch) score++;
  }
  if (nm.length > 0) {
    checks++;
    if (nombreMatch) score++;
  }

  return {
    paternoMatch,
    maternoMatch,
    nombreMatch,
    score: checks > 0 ? score / checks : 0,
  };
}
