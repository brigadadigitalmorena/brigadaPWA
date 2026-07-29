/**
 * 📐 INE Spatial OCR Extraction
 * =============================
 * Usa las coordenadas (bounding boxes) devueltas por ML Kit para asignar
 * bloques de texto a campos específicos de la INE basándose en la
 * disposición física conocida de la credencial.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ALGORITMO DE CLASIFICACIÓN ESPACIAL: "ANCLAS + FALLBACK PROPORCIONAL"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * El problema central es: dado un bloque de texto con coordenadas (x, y, w, h),
 * ¿a qué campo de la INE pertenece? (nombre, domicilio, CURP, etc.)
 *
 * ── Enfoque de proporciones fijas (simple, frágil) ─────────────────────────
 *
 *   Se define que "nombres están entre 8% y 32% del alto". Funciona si la
 *   foto está bien encuadrada, pero falla cuando:
 *     • La foto está inclinada o recortada
 *     • El modelo de INE es diferente (IFE 2008 vs INE 2019+)
 *     • La cámara captura bordes extra o recorta demasiado
 *   En esos casos, el 32% puede caer en la etiqueta DOMICILIO o viceversa.
 *
 * ── Enfoque de anclas por palabras clave (adaptativo, robusto) ─────────────
 *
 *   En vez de confiar sólo en porcentajes fijos, BUSCAMOS ETIQUETAS CONOCIDAS
 *   en los bloques OCR y usamos sus posiciones Y para definir las fronteras
 *   entre zonas dinamicamente.
 *
 *   **Paso 1 — Detección de anclas:**
 *   Recorremos todos los bloques buscando palabras clave impresas en la INE:
 *
 *     Ancla              │ Regex (OCR-tolerante)        │ Zona que delimita
 *     ───────────────────┼──────────────────────────────┼─────────────────────
 *     APELLIDO PATERNO   │ /PATERN[O0]/i                │ Inicio de NOMBRES
 *     DOMICILIO          │ /D[O0]M[I1]C[I1]L[I1][O0]/i │ Inicio de DIRECCIÓN
 *     CLAVE DE ELECTOR   │ /CLAVE.*ELECT/i              │ Inicio de DATOS
 *     CURP               │ /^CURP$/i                    │ Inicio de DATOS
 *     SECCIÓN            │ /SECCI[OÓ]N/i               │ Zona de DATOS
 *     INSTITUTO/ELECTORAL│ /INSTITUTO|ELECTORAL/i       │ HEADER
 *
 *     Para cada ancla encontrada, registramos su posición Y normalizada
 *     (proporción 0–1 respecto al alto total de la imagen).
 *
 *   **Paso 2 — Cálculo de zonas dinámicas:**
 *   Con las posiciones Y de las anclas, definimos fronteras entre zonas:
 *
 *     Zona        │ Empieza en...              │ Termina en...
 *     ────────────┼────────────────────────────┼────────────────────────
 *     HEADER      │ y = 0                      │ min(ancla_paterno, 0.10)
 *     NOMBRES     │ ancla_paterno − margen     │ ancla_domicilio
 *     DOMICILIO   │ ancla_domicilio            │ ancla_clave/curp
 *     DATOS       │ ancla_clave/curp           │ 1.0
 *
 *     El "margen" (ANCHOR_MARGIN) es ~3% del alto, para capturar la
 *     etiqueta misma y texto que esté pegado arriba de ella.
 *
 *   **Paso 3 — Fallback a proporciones fijas:**
 *   Si una ancla NO se encuentra (OCR ruidoso, reflejo en holograma, etc.),
 *   se usa la proporción fija correspondiente como fallback:
 *
 *     Ancla no encontrada  │ Se usa proporción fija
 *     ─────────────────────┼──────────────────────────
 *     PATERNO              │ nameYMin = 0.08
 *     DOMICILIO            │ addressYMin = 0.28
 *     CLAVE/CURP           │ dataYMin = 0.55
 *
 *   Esto da lo mejor de ambos mundos: adaptabilidad cuando hay buenas
 *   anclas, y robustez cuando el OCR está degradado.
 *
 * ── Ejemplo concreto ───────────────────────────────────────────────────────
 *
 *   Supongamos que ML Kit devuelve estos bloques con coordenadas Y:
 *
 *     Bloque                  │ Y normalizado │ Ancla detectada
 *     ────────────────────────┼───────────────┼──────────────────
 *     "INSTITUTO NACIONAL..." │     0.04      │ HEADER
 *     "APELLIDO PATERNO"      │     0.12      │ ★ PATERNO → 0.12
 *     "GARCIA"                │     0.17      │
 *     "APELLIDO MATERNO"      │     0.21      │
 *     "LOPEZ"                 │     0.25      │
 *     "NOMBRE(S)"             │     0.29      │
 *     "JUAN ANTONIO"          │     0.33      │
 *     "DOMICILIO"             │     0.38      │ ★ DOMICILIO → 0.38
 *     "C REFORMA 234"         │     0.43      │
 *     "COL CENTRO 06000"      │     0.48      │
 *     "CLAVE DE ELECTOR"      │     0.56      │ ★ CLAVE → 0.56
 *     "GRCLPJ900101M800"      │     0.61      │
 *     "CURP"                  │     0.66      │
 *     ...                     │     ...       │
 *
 *   Zonas dinámicas resultantes:
 *     HEADER:    y < 0.09   (ancla_paterno − margin = 0.12 − 0.03)
 *     NOMBRES:   0.09 ≤ y < 0.38
 *     DOMICILIO: 0.38 ≤ y < 0.56
 *     DATOS:     0.56 ≤ y
 *
 *   Esto asigna correctamente "JUAN ANTONIO" (y=0.33) a nombres y
 *   "C REFORMA 234" (y=0.43) a domicilio, sin importar que las
 *   proporciones fijas hubieran dicho lo contrario.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAYOUT FÍSICO DE LA INE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ── Layout REAL de la INE (frente) ──────────────────────────────────────────
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  INSTITUTO NACIONAL ELECTORAL               │  ← header (y: 0–8%)
 *   ├─────────┬───────────────────────────────────┤
 *   │         │  APELLIDO PATERNO                  │
 *   │  FOTO   │  GARCIA                            │  ← nombres (y: 8–30%, x >25%)
 *   │         │  APELLIDO MATERNO                  │
 *   │         │  LOPEZ                             │
 *   │         │  NOMBRE(S)                         │
 *   │         │  JUAN ANTONIO                      │
 *   │         ├───────────────────────────────────┤
 *   │         │  DOMICILIO                         │
 *   │         │  C REFORMA 234                     │  ← domicilio (y: 30–55%, x >25%)
 *   │         │  COL CENTRO C.P. 06000             │
 *   │         │  CUAUHTÉMOC CDMX                   │
 *   │         ├───────────────────────────────────┤
 *   │         │  CLAVE DE ELECTOR                  │
 *   │ FIRMA   │  CURP: GRCLPJ900101HMCRPN09       │  ← datos (y: 55–80%, x >25%)
 *   │         │  SECCIÓN: 1234  AÑO REG: 2015     │
 *   │         │  FECHA NAC: 01/01/1990             │
 *   ├─────────┴───────────────────────────────────┤
 *   │  SEXO: H  │  vigencia 2029  │  MRZ inferior │  ← footer (y: 80–100%)
 *   └─────────────────────────────────────────────┘
 *
 * **El DOMICILIO está en el FRENTE** de la INE, entre los nombres y los
 * datos de identificación (CURP, clave, sección).
 *
 * ── Layout de la INE (reverso) ──────────────────────────────────────────────
 *
 *   ┌─────────────────────────────────────────────┐
 *   │  Datos adicionales / código de barras        │
 *   │  MRZ (Machine Readable Zone)                │
 *   │  QR code / datos magnéticos                 │
 *   └─────────────────────────────────────────────┘
 *
 *   El reverso NO contiene el domicilio en la mayoría de los modelos.
 *   Algunos modelos antiguos (IFE) pueden tener info aquí, por eso
 *   mantenemos la búsqueda en reverso como fallback.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONSIDERACIONES DE DISEÑO
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. COORDENADAS DE ML KIT
 *    ML Kit devuelve coordenadas absolutas en píxeles de la imagen original.
 *    Normalizamos a proporciones 0–1 dividiendo por el ancho/alto estimado.
 *    El alto se estima como max(bloque.y + bloque.height) de todos los bloques.
 *
 * 2. TOLERANCIA OCR EN REGEXES
 *    Las etiquetas impresas en la INE pueden leerse con errores de OCR:
 *      O ↔ 0, I ↔ 1 ↔ L, S ↔ 5, etc.
 *    Todos los regex de anclas son OCR-tolerantes:
 *      "DOMICILIO" → /D[O0]M[I1]C[I1]L[I1][O0]/i
 *
 * 3. MARGEN DE ANCLAS (ANCHOR_MARGIN = 0.03)
 *    Entre una etiqueta y la frontera de zona hay un margen de 3% del alto.
 *    Esto captura la etiqueta misma y evita que texto pegado justo arriba
 *    de una frontera caiga en la zona equivocada.
 *
 * 4. SOLAPAMIENTO DE ZONAS
 *    Con proporciones fijas, las zonas se solapan intencionalmente
 *    (nombres 8–32% se solapa con dirección 28–58%) para captar bloques
 *    en la "frontera". Con anclas dinámicas, las fronteras son exactas
 *    y no hay solapamiento.
 *
 * 5. PRIORIDAD: ANCLA > PROPORCIÓN FIJA
 *    Si encontramos la ancla "DOMICILIO" a y=0.41, eso SIEMPRE gana sobre
 *    la proporción fija de 0.28. Las proporciones son solo el plan B.
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Bloque de texto con coordenadas espaciales de ML Kit */
export interface OcrBlock {
  text: string;
  frame?: { x: number; y: number; width: number; height: number };
  lines: { text: string; confidence?: number }[];
}

/** Resultado del análisis espacial: bloques clasificados por zona */
export interface SpatialZones {
  /** Bloques en la zona de nombres (frente, derecha-superior) */
  nameBlocks: OcrBlock[];
  /** Bloques en la zona de domicilio (frente, debajo de nombres) */
  addressBlocks: OcrBlock[];
  /** Bloques en la zona de datos (frente, parte media-baja) */
  dataBlocks: OcrBlock[];
  /** Bloques en la zona de datos del reverso */
  backDataBlocks: OcrBlock[];
  /** Texto combinado de la zona de nombres (para el parser) */
  nameText: string;
  /** Texto combinado de la zona de dirección (del frente) */
  addressText: string;
  /** Dimensiones de la imagen (para normalización) */
  imageWidth: number;
  imageHeight: number;
}

// ── Constantes de layout ────────────────────────────────────────────────────

/**
 * Proporciones FIJAS (fallback) del frente de la INE.
 *
 * Se usan SÓLO cuando no se detectan anclas de palabras clave.
 * Son valores promedio observados en INE modelos C/D (2015–2024).
 *
 * Nomenclatura de las proporciones (todo relativo al alto total):
 *   photoRightEdge — proporción X donde termina la foto (~25% del ancho)
 *   nameYMin/Max   — rango Y de la zona de nombres
 *   addressYMin/Max— rango Y de la zona de domicilio
 *   dataYMin/Max   — rango Y de la zona de datos (CURP, CLAVE, SECCIÓN)
 *   headerYMax     — límite superior de la zona header
 */
const FRONT_ZONES_FALLBACK = {
  photoRightEdge: 0.25,
  nameYMin: 0.08,
  nameYMax: 0.38,
  addressYMin: 0.36,
  addressYMax: 0.58,
  dataYMin: 0.55,
  dataYMax: 0.85,
  headerYMax: 0.1,
} as const;

/**
 * Zonas del reverso de la INE (proporciones fijas).
 * El reverso contiene MRZ, códigos de barras, QR y datos duplicados.
 * El domicilio NO está aquí en modelos modernos (está en el frente).
 * Se mantiene por compatibilidad con modelos antiguos (IFE).
 */
const BACK_ZONES = {
  addressYMin: 0.0,
  addressYMax: 0.5,
  dataYMin: 0.4,
  dataYMax: 0.8,
} as const;

/**
 * Margen alrededor de una ancla (proporción del alto).
 *
 * Cuando encontramos "DOMICILIO" a y=0.38, definimos la frontera en
 * y=0.38 − ANCHOR_MARGIN = 0.35 para capturar texto ligeramente arriba.
 * Este margen compensa:
 *   - Imprecisión del bounding-box de ML Kit (~1-2%)
 *   - Texto que está "pegado" justo arriba de la etiqueta
 *   - Variación entre modelos de INE
 */
const ANCHOR_MARGIN = 0.03;

// ═══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE ANCLAS POR PALABRAS CLAVE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Anclas detectadas: posiciones Y (normalizadas 0–1) de etiquetas conocidas.
 *
 * Cada campo es `undefined` si la ancla no fue encontrada en los bloques OCR.
 * Los valores representan el centro Y normalizado del bloque que contiene
 * la ancla.
 */
interface AnchorPositions {
  /** Y de "INSTITUTO NACIONAL ELECTORAL" o similar */
  header?: number;
  /** Y de "APELLIDO PATERNO" — marca el inicio de la zona de nombres */
  paterno?: number;
  /** Y de "DOMICILIO" — marca el inicio de la zona de dirección */
  domicilio?: number;
  /**
   * Y de "CLAVE DE ELECTOR" o "CURP" (la que aparezca primero).
   * Marca el inicio de la zona de datos de identificación.
   */
  claveOrCurp?: number;
  /** Y de la primera línea MRZ (contiene "<<<") — marca el footer */
  mrz?: number;
}

/**
 * Zonas dinámicas calculadas a partir de anclas (o fallbacks fijos).
 *
 * Los rangos son [min, max) — un bloque pertenece a la zona si su
 * centro Y normalizado cumple: min ≤ centerY < max.
 */
interface DynamicZones {
  /** Rango Y del header institucional */
  headerY: [number, number];
  /** Rango Y de la zona de nombres (a la derecha de la foto) */
  nameY: [number, number];
  /** Rango Y de la zona de domicilio (a la derecha de la foto) */
  addressY: [number, number];
  /** Rango Y de la zona de datos (CURP, CLAVE, SECCIÓN, VIGENCIA) */
  dataY: [number, number];
  /** X mínimo para la zona derecha (excluye la foto) */
  photoRightEdge: number;
  /** Indica si las zonas se calcularon con anclas (true) o fallback (false) */
  usedAnchors: boolean;
}

// ── Regex OCR-tolerantes para palabras clave de la INE ──────────────────────
// Cada regex tolera las confusiones más comunes del OCR (O↔0, I↔1, etc.)

/** APELLIDO PATERNO — puede venir como "PATERNO" solo o con prefijo */
const RE_PATERNO = /(?:A(?:PELLID|PELL[I1]D)[O0]\s+)?PATERN[O0]/i;

/** DOMICILIO — ancla principal de dirección */
const RE_DOMICILIO = /D[O0]M[I1]C[I1]L[I1][O0]/i;

/** CLAVE DE ELECTOR — inicio de zona de datos */
const RE_CLAVE_ELECTOR = /CLAVE\s*(?:DE\s*)?ELECT[O0]R/i;

/** CURP (etiqueta sola, no el valor) */
const RE_CURP_LABEL = /^CURP$/i;

/** SECCIÓN — pertenece a zona de datos */
const RE_SECCION = /SECCI[OÓ]N/i;

/** Header institucional — INSTITUTO, ELECTORAL, CREDENCIAL */
const RE_HEADER = /INSTITUTO|NACIONAL\s+ELECTORAL|CREDENCIAL\s+PARA/i;

/** MRZ — Machine Readable Zone, indica footer */
const RE_MRZ = /<<<|[A-Z]{1}<<[A-Z]/;

/**
 * Detecta anclas de palabras clave en los bloques OCR.
 *
 * Recorre todos los bloques buscando etiquetas conocidas de la INE.
 * Para cada ancla encontrada, registra la posición Y normalizada (0–1)
 * del centro del bloque que la contiene.
 *
 * Si una misma ancla aparece múltiples veces (p.ej. "CURP" como etiqueta
 * y como valor), se toma la primera aparición (la de menor Y), ya que las
 * etiquetas siempre están arriba de los valores.
 *
 * @param blocks  Bloques OCR del frente de la INE con coordenadas
 * @param dims    Dimensiones estimadas de la imagen {width, height}
 * @returns       Mapa de posiciones Y de anclas encontradas
 *
 * @example
 * ```
 * const dims = estimateImageDimensions(blocks);
 * const anchors = detectAnchors(blocks, dims);
 * // anchors.paterno = 0.12  (encontró "APELLIDO PATERNO" a 12% del alto)
 * // anchors.domicilio = 0.38  (encontró "DOMICILIO" a 38% del alto)
 * // anchors.claveOrCurp = 0.56  (encontró "CLAVE DE ELECTOR" a 56% del alto)
 * ```
 */
function detectAnchors(
  blocks: OcrBlock[],
  dims: { width: number; height: number },
): AnchorPositions {
  const anchors: AnchorPositions = {};

  for (const block of blocks) {
    if (!block.frame) continue;

    // Centro Y normalizado del bloque
    const centerY = (block.frame.y + block.frame.height / 2) / dims.height;

    // Texto completo del bloque (ML Kit a veces fusiona varias líneas)
    const text = block.text.toUpperCase();

    // Revisar también cada línea individualmente (más preciso)
    const allTexts = [text, ...block.lines.map((l) => l.text.toUpperCase())];

    for (const t of allTexts) {
      // Header institucional
      if (RE_HEADER.test(t) && anchors.header === undefined) {
        anchors.header = centerY;
      }

      // APELLIDO PATERNO — inicio de nombres
      if (RE_PATERNO.test(t) && anchors.paterno === undefined) {
        anchors.paterno = centerY;
      }

      // DOMICILIO — inicio de dirección
      if (RE_DOMICILIO.test(t) && anchors.domicilio === undefined) {
        anchors.domicilio = centerY;
      }

      // CLAVE DE ELECTOR o CURP — inicio de datos
      if (
        (RE_CLAVE_ELECTOR.test(t) ||
          RE_CURP_LABEL.test(t) ||
          RE_SECCION.test(t)) &&
        anchors.claveOrCurp === undefined
      ) {
        anchors.claveOrCurp = centerY;
      }

      // MRZ — footer
      if (RE_MRZ.test(t) && anchors.mrz === undefined) {
        anchors.mrz = centerY;
      }
    }
  }

  return anchors;
}

/**
 * Calcula zonas dinámicas basadas en anclas detectadas.
 *
 * Usa la posición Y de cada ancla (si fue encontrada) para definir las
 * fronteras entre zonas. Si una ancla no fue encontrada, se usa el
 * valor fijo de fallback correspondiente.
 *
 * ── Lógica de cálculo ─────────────────────────────────────────────────────
 *
 * Para cada frontera, se toma:
 *   frontera = ancla encontrada ? (ancla.y − ANCHOR_MARGIN) : fallback_fijo
 *
 * Las fronteras dividen el eje Y en 4 rangos:
 *   [0, headerEnd)         → HEADER
 *   [headerEnd, addrStart) → NOMBRES
 *   [addrStart, dataStart) → DOMICILIO
 *   [dataStart, 1.0)       → DATOS
 *
 * ── Validación de coherencia ──────────────────────────────────────────────
 *
 * Se verifica que las anclas detectadas estén en orden lógico:
 *   paterno.y < domicilio.y < claveOrCurp.y
 *
 * Si alguna ancla rompe el orden (p.ej. un falso positivo de "CLAVE" que
 * aparece arriba de "DOMICILIO"), se descarta y se usa el fallback.
 *
 * @param anchors  Anclas detectadas (puede tener campos undefined)
 * @returns        Zonas dinámicas con rangos [min, max) para cada zona
 *
 * @example
 * ```
 * const zones = computeDynamicZones({
 *   paterno: 0.12,
 *   domicilio: 0.38,
 *   claveOrCurp: 0.56,
 * });
 * // zones.nameY    = [0.09, 0.35]  (paterno − margin → domicilio − margin)
 * // zones.addressY = [0.35, 0.53]  (domicilio − margin → clave − margin)
 * // zones.dataY    = [0.53, 1.00]  (clave − margin → final)
 * ```
 */
function computeDynamicZones(anchors: AnchorPositions): DynamicZones {
  const fb = FRONT_ZONES_FALLBACK;

  // ── Validar orden lógico de anclas ─────────────────────────────────────
  // Si las anclas detectadas NO están en orden vertical correcto, las
  // descartamos (probablemente falsos positivos del OCR).
  let { paterno, domicilio, claveOrCurp } = anchors;

  if (
    paterno !== undefined &&
    domicilio !== undefined &&
    paterno >= domicilio
  ) {
    // "PATERNO" apareció debajo de "DOMICILIO" — imposible, descartar
    paterno = undefined;
  }
  if (
    domicilio !== undefined &&
    claveOrCurp !== undefined &&
    domicilio >= claveOrCurp
  ) {
    // "DOMICILIO" apareció debajo de "CLAVE/CURP" — imposible, descartar
    claveOrCurp = undefined;
  }
  if (
    paterno !== undefined &&
    claveOrCurp !== undefined &&
    paterno >= claveOrCurp
  ) {
    // "PATERNO" apareció debajo de "CLAVE/CURP" — imposible, descartar ambos
    paterno = undefined;
    claveOrCurp = undefined;
  }

  // ── Calcular fronteras ─────────────────────────────────────────────────
  // Cada frontera es: ancla encontrada − margen, ó fallback si no hay ancla

  const headerEnd =
    paterno !== undefined
      ? Math.max(paterno - ANCHOR_MARGIN, 0.02)
      : fb.headerYMax;

  const nameStart =
    paterno !== undefined
      ? Math.max(paterno - ANCHOR_MARGIN, headerEnd)
      : fb.nameYMin;

  const addressStart =
    domicilio !== undefined
      ? Math.max(domicilio - ANCHOR_MARGIN, nameStart + 0.05)
      : fb.addressYMin;

  const dataStart =
    claveOrCurp !== undefined
      ? Math.max(claveOrCurp - ANCHOR_MARGIN, addressStart + 0.05)
      : fb.dataYMin;

  const usedAnchors =
    paterno !== undefined ||
    domicilio !== undefined ||
    claveOrCurp !== undefined;

  return {
    headerY: [0, headerEnd],
    nameY: [nameStart, addressStart],
    addressY: [addressStart, dataStart],
    dataY: [dataStart, 1.0],
    photoRightEdge: fb.photoRightEdge,
    usedAnchors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estima las dimensiones de la imagen a partir de los bloques OCR.
 *
 * ML Kit devuelve coordenadas absolutas en píxeles de la imagen original.
 * Como no recibimos las dimensiones explícitamente, las estimamos usando
 * el bloque más lejano en cada eje (X+width, Y+height).
 *
 * Si ningún bloque tiene frame, usamos un valor por defecto de 4032×3024
 * (resolución típica de cámara de teléfono en modo 4:3).
 *
 * @param blocks  Bloques OCR con coordenadas opcionales
 * @returns       {width, height} estimados en píxeles
 */
function estimateImageDimensions(blocks: OcrBlock[]): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;
  for (const b of blocks) {
    if (b.frame) {
      const right = b.frame.x + b.frame.width;
      const bottom = b.frame.y + b.frame.height;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
  }
  return {
    width: maxX > 0 ? maxX : 4032,
    height: maxY > 0 ? maxY : 3024,
  };
}

/**
 * Clasifica bloques del frente de la INE en zonas espaciales.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Esta es la función principal del módulo. Implementa el algoritmo de
 * "anclas + fallback proporcional" descrito en el header del archivo.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Flujo:
 *   1. Estimar dimensiones de la imagen
 *   2. Detectar anclas por palabras clave (PATERNO, DOMICILIO, CLAVE/CURP)
 *   3. Calcular zonas dinámicas basadas en las distancias entre anclas
 *   4. Clasificar cada bloque según su posición Y normalizada
 *
 * Cada bloque se asigna a exactamente UNA zona:
 *   - headerBlocks:  encabezado institucional (INE, CREDENCIAL PARA VOTAR)
 *   - nameBlocks:    apellidos y nombre(s) del titular
 *   - addressBlocks: domicilio completo (calle, colonia, C.P., municipio)
 *   - dataBlocks:    CURP, CLAVE DE ELECTOR, SECCIÓN, fechas, sexo, etc.
 *
 * Excepciones a la clasificación por posición:
 *   - Si un bloque SIN coordenadas contiene ancla "DOMICILIO" o "COL." o
 *     "C.P. XXXXX", se clasifica como domicilio independientemente.
 *   - Si un bloque EN LA ZONA DE NOMBRES contiene "DOMICILIO", se
 *     reclasifica como domicilio (la etiqueta puede estar "pegada" arriba).
 *
 * @param blocks  Bloques OCR del frente de la INE con coordenadas de ML Kit
 * @returns       Bloques clasificados por zona + headerBlocks
 */
export function classifyFrontBlocks(blocks: OcrBlock[]): {
  nameBlocks: OcrBlock[];
  addressBlocks: OcrBlock[];
  dataBlocks: OcrBlock[];
  headerBlocks: OcrBlock[];
} {
  const dims = estimateImageDimensions(blocks);

  // ── Paso 1: Detectar anclas ──────────────────────────────────────────
  const anchors = detectAnchors(blocks, dims);

  // ── Paso 2: Calcular zonas dinámicas ─────────────────────────────────
  const zones = computeDynamicZones(anchors);

  // ── Paso 3: Clasificar bloques ───────────────────────────────────────
  const nameBlocks: OcrBlock[] = [];
  const addressBlocks: OcrBlock[] = [];
  const dataBlocks: OcrBlock[] = [];
  const headerBlocks: OcrBlock[] = [];

  for (const block of blocks) {
    if (!block.frame) {
      // Sin coordenadas — clasificar por contenido textual
      if (
        /D[O0]M[I1]C[I1]L[I1][O0]|COL\.?\s|C\.?\s*P\.?\s*\d{5}/i.test(
          block.text,
        )
      ) {
        addressBlocks.push(block);
      } else {
        dataBlocks.push(block);
      }
      continue;
    }

    // Normalizar coordenadas a proporciones 0–1
    const relX = block.frame.x / dims.width;
    const relCenterY = (block.frame.y + block.frame.height / 2) / dims.height;

    // Header institucional
    if (relCenterY < zones.headerY[1]) {
      headerBlocks.push(block);
      continue;
    }

    // A la derecha de la foto (necesario para nombres y domicilio)
    const rightOfPhoto = relX >= zones.photoRightEdge;

    // Zona de nombres
    if (
      rightOfPhoto &&
      relCenterY >= zones.nameY[0] &&
      relCenterY < zones.nameY[1]
    ) {
      // Si el bloque contiene "DOMICILIO", reclasificar como dirección
      if (RE_DOMICILIO.test(block.text)) {
        addressBlocks.push(block);
      } else {
        nameBlocks.push(block);
      }
      continue;
    }

    // Zona de domicilio
    if (
      rightOfPhoto &&
      relCenterY >= zones.addressY[0] &&
      relCenterY < zones.addressY[1]
    ) {
      // Si el bloque contiene una etiqueta de nombre (PATERNO, MATERNO, NOMBRE),
      // reclasificar como nombre. Esto ocurre cuando la frontera de zona está
      // calculada incorrectamente (p.ej. DOMICILIO anchor no fue detectada
      // y el fallback es demasiado bajo, capturando los últimos campos de nombre).
      const blockUpper = block.text.toUpperCase();
      if (
        RE_PATERNO.test(blockUpper) ||
        /MATERN[O0]/i.test(blockUpper) ||
        /^N[O0]MBRE/i.test(blockUpper)
      ) {
        nameBlocks.push(block);
      } else {
        addressBlocks.push(block);
      }
      continue;
    }

    // Zona de datos
    if (relCenterY >= zones.dataY[0]) {
      dataBlocks.push(block);
      continue;
    }

    // Default: datos
    dataBlocks.push(block);
  }

  // Ordenar bloques por Y (lectura top→bottom)
  nameBlocks.sort((a, b) => (a.frame?.y ?? 0) - (b.frame?.y ?? 0));
  addressBlocks.sort((a, b) => (a.frame?.y ?? 0) - (b.frame?.y ?? 0));
  dataBlocks.sort((a, b) => (a.frame?.y ?? 0) - (b.frame?.y ?? 0));

  return { nameBlocks, addressBlocks, dataBlocks, headerBlocks };
}

/**
 * Clasifica bloques del reverso de la INE en zonas espaciales.
 *
 * El reverso usa proporciones FIJAS (no anclas dinámicas) porque su layout
 * es menos estandarizado que el frente:
 *   - Mitad superior (y<50%): posible zona de dirección (modelos IFE antiguos)
 *   - Mitad inferior (y>40%): datos duplicados, MRZ, QR, código de barras
 *
 * NOTA: En modelos modernos (INE 2015+), el domicilio NO está en el reverso.
 * Esta función se mantiene como fallback para modelos antiguos.
 *
 * @param blocks  Bloques OCR del reverso con coordenadas
 * @returns       Bloques clasificados en addressBlocks y dataBlocks
 */
export function classifyBackBlocks(blocks: OcrBlock[]): {
  addressBlocks: OcrBlock[];
  dataBlocks: OcrBlock[];
} {
  const dims = estimateImageDimensions(blocks);
  const addressBlocks: OcrBlock[] = [];
  const dataBlocks: OcrBlock[] = [];

  for (const block of blocks) {
    if (!block.frame) {
      dataBlocks.push(block);
      continue;
    }

    const relCenterY = (block.frame.y + block.frame.height / 2) / dims.height;

    if (relCenterY <= BACK_ZONES.addressYMax) {
      addressBlocks.push(block);
    } else {
      dataBlocks.push(block);
    }
  }

  addressBlocks.sort((a, b) => (a.frame?.y ?? 0) - (b.frame?.y ?? 0));
  dataBlocks.sort((a, b) => (a.frame?.y ?? 0) - (b.frame?.y ?? 0));

  return { addressBlocks, dataBlocks };
}

/**
 * Extrae nombres estructurados de los bloques de la zona de nombres.
 *
 * ── Patrones esperados de ML Kit ──────────────────────────────────────────
 *
 *   Caso 1 — Etiqueta y valor en bloques separados:
 *     Bloque 1: "APELLIDO PATERNO"    (etiqueta)
 *     Bloque 2: "GARCIA"              (valor)
 *     Bloque 3: "APELLIDO MATERNO"    (etiqueta)
 *     Bloque 4: "LOPEZ"              (valor)
 *     Bloque 5: "NOMBRE(S)"          (etiqueta)
 *     Bloque 6: "JUAN ANTONIO"       (valor)
 *
 *   Caso 2 — Etiqueta y valor en la misma línea (inline):
 *     Bloque 1: "APELLIDO PATERNO GARCIA"
 *     Bloque 2: "APELLIDO MATERNO LOPEZ"
 *     Bloque 3: "NOMBRE(S) JUAN ANTONIO"
 *
 *   Caso 3 — ML Kit fusiona todo en un solo bloque multi-línea:
 *     Bloque 1, línea 1: "APELLIDO PATERNO"
 *     Bloque 1, línea 2: "GARCIA"
 *     Bloque 1, línea 3: "APELLIDO MATERNO"
 *     ... etc.
 *
 * La función maneja los 3 casos:
 *   - Primero intenta emparejar etiqueta+siguiente línea (Caso 1 y 3)
 *   - Si no, intenta extraer el valor inline (Caso 2)
 *
 * Los bloques se asumen ordenados por Y (top→bottom), ya que
 * classifyFrontBlocks los ordena antes de devolverlos.
 *
 * @param nameBlocks  Bloques OCR ya filtrados a la zona de nombres
 * @returns           Nombre desestructurado o null si no se encontró nada
 */
export function extractNamesFromSpatial(nameBlocks: OcrBlock[]): {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  method: "spatial";
} | null {
  if (nameBlocks.length === 0) return null;

  const result = {
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
  };

  // Agrupar bloques en pares (etiqueta → valor) por proximidad Y
  // Los bloques ya están ordenados por Y.
  const lines: string[] = [];
  for (const block of nameBlocks) {
    // Cada bloque puede tener múltiples líneas
    for (const line of block.lines) {
      if (line.text.trim().length >= 2) {
        lines.push(line.text.trim().toUpperCase());
      }
    }
  }

  // Buscar etiquetas seguidas de valores
  const PATERNO_RE = /^(?:A(?:PELLID|PELL[I1]D)[O0]\s+)?PATERN[O0]$/i;
  const MATERNO_RE = /^(?:A(?:PELLID|PELL[I1]D)[O0]\s+)?MATERN[O0]$/i;
  const NOMBRE_RE = /^N[O0]MBRE(?:\([S5]\))?$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : null;

    if (PATERNO_RE.test(line) && nextLine && !isLabelLine(nextLine)) {
      result.apellidoPaterno = cleanValue(nextLine);
      i++; // skip value line
    } else if (MATERNO_RE.test(line) && nextLine && !isLabelLine(nextLine)) {
      result.apellidoMaterno = cleanValue(nextLine);
      i++;
    } else if (NOMBRE_RE.test(line) && nextLine && !isLabelLine(nextLine)) {
      result.nombre = cleanValue(nextLine);
      i++;
    }
    // Inline: "APELLIDO PATERNO GARCIA"
    else {
      const inlinePat = line.match(
        /^(?:A(?:PELLID|PELL[I1]D)[O0]\s+)?PATERN[O0]\s+(.+)$/i,
      );
      if (inlinePat && !result.apellidoPaterno) {
        result.apellidoPaterno = cleanValue(inlinePat[1]);
        continue;
      }
      const inlineMat = line.match(
        /^(?:A(?:PELLID|PELL[I1]D)[O0]\s+)?MATERN[O0]\s+(.+)$/i,
      );
      if (inlineMat && !result.apellidoMaterno) {
        result.apellidoMaterno = cleanValue(inlineMat[1]);
        continue;
      }
      const inlineNom = line.match(/^N[O0]MBRE(?:\([S5]\))?\s+(.+)$/i);
      if (inlineNom && !result.nombre) {
        result.nombre = cleanValue(inlineNom[1]);
        continue;
      }
    }
  }

  const found =
    result.apellidoPaterno || result.apellidoMaterno || result.nombre;

  if (found) return { ...result, method: "spatial" };

  // ── Fallback posicional ─────────────────────────────────────────────────
  // Si no se encontraron etiquetas pero hay líneas de texto en la zona de
  // nombres (p.ej. ML Kit no leyó los labels por reflejo del holograma),
  // asumir el orden posicional estándar de la INE:
  //   Línea 1 → APELLIDO PATERNO
  //   Línea 2 → APELLIDO MATERNO
  //   Línea 3+ → NOMBRE(S)
  //
  // Solo se activa si hay ≥2 líneas que parezcan valores de nombre
  // (letras mayúsculas, sin etiquetas, sin encabezados institucionales).
  const valueLines = lines.filter((l) => {
    if (isLabelLine(l)) return false;
    // Filtrar texto institucional
    if (
      /^(INSTITUTO|CREDENCIAL|ELECTORAL|INE|IFE|NACIONAL|PARA\s+VOTAR)/i.test(l)
    )
      return false;
    // Filtrar líneas muy cortas
    if (l.length < 2) return false;
    // Filtrar líneas que parecen datos (CURP, fechas, secciones)
    if (/\d{4,}/.test(l)) return false;
    // Aceptar solo texto que parezca nombres: letras + espacios + acentos
    const cleaned = l.replace(/[0-9]/g, "");
    return /^[A-ZÁÉÍÓÚÑÜ\s]{2,}$/.test(cleaned);
  });

  if (valueLines.length >= 2) {
    return {
      apellidoPaterno: cleanValue(valueLines[0]),
      apellidoMaterno: cleanValue(valueLines[1]),
      nombre:
        valueLines.length >= 3 ? cleanValue(valueLines.slice(2).join(" ")) : "",
      method: "spatial",
    };
  }

  return null;
}

/**
 * @deprecated Usar extractAddressFromSpatialExpert de ine-address.ts
 * Extrae dirección de los bloques espaciales (versión simple).
 * Puede recibir bloques del frente o del reverso.
 * Los bloques se concatenan en orden Y para formar la dirección completa.
 */
export function extractAddressFromSpatial(addressBlocks: OcrBlock[]): {
  value: string;
  confidence: number;
} {
  if (addressBlocks.length === 0) return { value: "", confidence: 0 };

  const lines: string[] = [];
  for (const block of addressBlocks) {
    for (const line of block.lines) {
      const text = line.text.trim().toUpperCase();
      if (text.length < 2) continue;
      // Filtrar líneas institucionales
      if (/INSTITUTO\s+(?:NACIONAL|FEDERAL)/i.test(text)) continue;
      if (/CREDENCIAL\s+PARA\s+VOTAR/i.test(text)) continue;
      // Filtrar etiqueta "DOMICILIO" sola
      if (/^D[O0]M[I1]C[I1]L[I1][O0]$/i.test(text)) continue;
      // Filtrar MRZ
      if (text.includes("<")) continue;
      lines.push(text);
    }
  }

  if (lines.length === 0) return { value: "", confidence: 0 };

  // Limpiar etiqueta "DOMICILIO" si aparece al inicio de una línea
  const cleaned = lines
    .map((l) =>
      l
        .replace(/^D[O0]M[I1]C[I1]L[I1][O0]\s+/i, "")
        .replace(/[|]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((l) => l.length >= 2);

  const address = cleaned.join(", ");

  // Calcular confianza basada en patrones de dirección
  const hasNumero = /\d{1,5}/.test(address);
  const hasCP =
    /C\.?\s*P\.?\s*\d{5}/i.test(address) || /\b\d{5}\b/.test(address);
  const hasColonia = /COL\.?|COLONIA|FRACC\.?/i.test(address);
  const hasMunicipio = /MUNICIPIO|DELEGACI[OÓ]N|ALCALD[IÍ]A/i.test(address);
  const matchCount = [
    hasNumero,
    hasCP,
    hasColonia,
    hasMunicipio,
    cleaned.length >= 2,
  ].filter(Boolean).length;
  const confidence = Math.min(0.5 + matchCount * 0.12, 0.98);

  return { value: address, confidence };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determina si una línea de texto es una etiqueta de campo de la INE.
 *
 * Las etiquetas son texto impreso en la credencial que identifica campos:
 * "APELLIDO PATERNO", "NOMBRE(S)", "CURP", "CLAVE DE ELECTOR", etc.
 *
 * Se usa para distinguir etiquetas de valores cuando ML Kit devuelve
 * líneas consecutivas (etiqueta → valor). Si la línea siguiente a una
 * etiqueta TAMBIÉN es etiqueta, entonces el valor está ausente.
 *
 * @param text  Línea de texto a evaluar
 * @returns     true si parece una etiqueta de campo
 */
function isLabelLine(text: string): boolean {
  return /^(?:A(?:PELLID|PELL[I1]D)[O0]|PATERN[O0]|MATERN[O0]|N[O0]MBRE|SEXO|FECHA|CURP|CLAVE|DOMICILIO|SECCI[OÓ]N|VIGENCIA|Estado|Municipio)/i.test(
    text,
  );
}

/**
 * Limpia un valor extraído de OCR para que solo contenga letras y espacios.
 *
 * Los valores de nombres en la INE son texto puro (no tienen números ni
 * caracteres especiales). Esta función elimina ruido del OCR como:
 *   - Dígitos confundidos con letras: "GARC1A" → "GARC A" → "GARC A"
 *   - Caracteres de borde: "| GARCIA |" → "GARCIA"
 *   - Espacios dobles
 *
 * Preserva acentos y Ñ (caracteres válidos en nombres mexicanos).
 *
 * @param s  Texto crudo del OCR
 * @returns  Texto limpio con solo letras, acentos y espacios
 */
function cleanValue(s: string): string {
  return s
    .replace(/[^A-ZÁÉÍÓÚÑÜ\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
