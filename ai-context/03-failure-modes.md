# Modos de Fallo - brigadaPWA

## Clasificación

| Severidad | Código | Descripción |
|-----------|--------|-------------|
| **Catastrófico** | P0 | Pérdida de datos, exposición PII, bloqueo total |
| **Mayor** | P1 | Funcionalidad core rota, reintentos infinitos, datos incompletos |
| **Menor** | P2 | Degradación UX, deuda técnica, inconsistencia visual |

---

## P0 - Catastrófico

### PWA-P0-SW-AUTH-CACHE — Service Worker cachea respuestas autenticadas sin `Vary: Authorization`

**Síntomas**: Dos brigadistas usan el mismo dispositivo. Brigadista A hace login, ve sus asignaciones y padrones. Cierra sesión. Brigadista B hace login → ve datos de A (padrones, respuestas, hogares) por 5 minutos en `api-cache-v4`.

**Causa raíz**: `workers/sw.js:226-239` registra `NetworkFirst` para **todo** `GET /api/*` (incluye `/api/backend/*` que proxyea todo el tráfico autenticado). La clave de caché es solo la URL. No hay `Vary: Authorization`. Logout no purga `api-cache*`.

**Impacto**: Exposición de PII (INE, CURP, firmas, coordenadas GPS, padrones de hogares). Violación de protección de datos.

**Mitigación aplicada (2026-09-26)**:
- Excluir `/api/backend/` del caché SW (`!url.pathname.startsWith('/api/backend/')`)
- `clearDatabase()` ahora purga `api-cache*` y `default-cache` en logout
- `setDefaultHandler` tiene `ExpirationPlugin(maxEntries: 100, maxAgeSeconds: 86400)`
- Bump de versión de caché (`api-cache-v4` → `v5`) purga entradas existentes en próximo deploy

**Verificación**: Deploy a producción → cerrar sesión → abrir DevTools Application → Cache Storage → confirmar que `api-cache-v5` existe y `api-cache-v4` fue purgado.

---

### PWA-P0-HIDDEN-ANSWERS — Respuestas de preguntas ocultas se envían al backend

**Síntomas**: Usuario responde "Sí" a Q1 → aparece Q2 → responde Q2 → cambia Q1 a "No" → finaliza. Backend rechaza toda la respuesta con `form_engine_violation`. Reintentos fallan igual → `dead_letter`. Usuario no puede corregir.

**Causa raíz**: `src/app/(dashboard)/surveys/[id]/fill/page.tsx:235` serializa `answers` (store completo) en vez de `fillableQuestions` filtrados por relevancia. `setAnswer` nunca borra claves. Validación en cliente (`:212-226`) usa el set filtrado, pero envío usa el crudo.

**Impacto**: Pérdida de trabajo del brigadista, frustración, datos en dead letter requieren intervención manual.

**Fix requerido**:
1. En `finalizeResponse`: construir payload desde `fillableQuestions.map(q => ({ [key]: answers[key] }))`
2. En replay (`sync-engine.service.ts`): detectar `form_engine_violation` → podar respuestas de preguntas no visibles → reintentar automáticamente (patrón App: `MOB-HIDDEN-FIELD-SUBMIT-2026-05-17` / `MOB-HIDDEN-FIELD-REPLAY-2026-05-18`)

---

### PWA-P0-INE-NO-ANSWER — Captura INE completa pero no genera respuesta

**Síntomas**: Usuario fotografía INE frente/reverso → OCR extrae CURP, nombre, domicilio → UI muestra datos → usuario finaliza encuesta → respuesta enviada **sin** campo INE.

**Causa raíz**: `src/components/survey/QuestionTypes/ine-question.tsx:18` declara `Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>`. El componente **no recibe `onChange`** y no tiene `value`. Guarda imagen y OCR en estado local, pero nunca llama `onChange(buildFlatIneAnswer(...))`.

**Impacto**: Dato legal (identidad) no capturado. Backend puede rechazar por campo requerido faltante.

**Fix requerido**:
- Recibir `onChange` y `value` en props
- Al completar OCR (ambos lados si aplica): `onChange(buildFlatIneAnswer({ curp, nombre, domicilio, ... }))`
- Añadir validación de campos obligatorios INE en `validate-answer.ts` (ver `brigadaApp/lib/forms/validation.ts:DEFAULT_REQUIRED_INE_FIELDS`)

---

## P1 - Mayor

### PWA-P1-VALIDATION-PARITY — Cliente valida 20/48 reglas del backend

**Causa raíz**: `src/lib/forms/validate-answer.ts` (262 líneas) vs `brigadaApp/lib/forms/validation.ts` (784 líneas, 48 reglas). Faltan:

| Categoría | Reglas faltantes |
|-----------|------------------|
| GIS | `min_area_m`, `max_area_m`, `min_accuracy_m`, `max_accuracy_m`, `require_altitude`, `max_distance_m`, `min_points`, `max_points` |
| Multimedia | `max_size_mb`, `allowed_formats`, `allowed_mimes`, `formats`, `max_duration_s` |
| Tiempo | `min_time`, `max_time`, `min_datetime`, `max_datetime`, `step` |
| Tipos | `types` (array de tipos permitidos) |
| INE | `required_fields` (CURP, nombre, domicilio, vigencia) |
| Normalización | `normalize_trim`, `normalize_uppercase`, `normalize_lowercase`, `normalize_strip_accents`, `normalize_remove_spaces`, `normalize_alpha_numeric`, `normalize_phone` |

**Impacto**: Validación pasa en cliente → falla en backend → reintentos quemando `max_retries` → `dead_letter`. Divergencia silenciosa de calidad de datos (sin `normalize_*` el texto se envía crudo).

**Fix**: Portar reglas faltantes a módulo compartido o replicar en PWA. Añadir `normalizeAnswerByRules` (App: `lib/forms/validation.ts:normalizeAnswerByRules`).

---

### PWA-P1-OCR-PARSER-DRIFT — Parser OCR 888 líneas detrás de la App

**Causa raíz**: `brigadaApp` commit `4fb63e4` (2026-09-26) añadió 18 funciones de endurecimiento CURP/Clave Elector. PWA no los recibió.

**Funciones ausentes en PWA**:
`extractCurpCandidates`, `scoreCurpCandidate`, `pickBestCurp`, `crossRepairClaveWithCurp`, `extractClaveElectorCandidates`, `pickBestClaveElector`, `scoreClaveCandidate`, `healNamesFromClave`, `extractSeccionFromBlocks`, `pickSeccionFromTokens`, `isClassicFooterLabelRow`, `looksLikeBirthYear`, `looksLikeCurpWindow`, `birthYearsInText`, `compactAlphanumeric`, `findWordStartingWith`, `lettersOnly` + 3 regex constantes.

**Impacto**: Un carácter mal leído en CURP → extracción falla completamente (App antes de `4fb63e4`). Validación MRZ posterior falla.

**Fix**: Portar funciones + test de regresión. Guardrail CI para detectar divergencia futura (`guardrails.md`).

---

### PWA-P1-CROSS-TAB-UPLOAD — Subida de archivos sin exclusión mutua entre pestañas

**Causa raíz**: `inFlightUploads` es `Set` a nivel módulo (`sync-engine.service.ts:56`). Dos pestañas = dos uploads concurrentes del mismo `file_id` → duplicados en backend.

**Fix**: Usar `BroadcastChannel` o lock en IndexedDB (`database.acquireProcessLock` patrón) para single-flight cross-tab. App fix: `MOB-ONLINE-MEDIA-DUPLICATE-2026-05-16`.

---

### PWA-P1-SYNC-UI-LIFECYCLE — Sync acoplado a ciclo de vida React

**Causa raíz**: `sync.context.tsx` posee NetInfo listeners, `setInterval`, `visibilitychange`/`focus`, mensajería SW. Múltiples instancias o unmount prematuro = race conditions.

**Fix**: Extraer `syncOrchestrator` singleton (App: `lib/services/sync-orchestrator.service.ts`). App fix: `MOB-SYNC-UI-LIFECYCLE-2026-05-17`.

---

### PWA-P1-ERROR-CLASSIFIER — Clasificador de errores de upload incompleto

**Síntomas**: `R2_RATE_LIMITED` y `R2_403_EXPIRED` emitidos (`sync-engine.service.ts:518-523`) pero **sin entrada en `error-copy.ts`** → texto genérico. App tiene `classifyUploadError()` + `MOB-R2-403-ALL-EXPIRED-2026-06-11`.

---

### PWA-P1-READONLY-CALCULATED — Campos `read_only` y `calculated` honrados asimétricamente

**Síntomas**: Preguntas `read_only` del backend renderizan editables en PWA. `data_list` cae en renderer no soportado (`question-renderer.tsx:9` importa `DataListQuestion` y nunca lo despacha).

---

## P2 - Menor

| Código | Descripción |
|--------|-------------|
| PWA-P2-STORAGE-UNBOUNDED | `offline-tiles.service.ts` mide quota pero no aplica tope (App: 200MB + cleanup 6h + rutas protegidas) |
| PWA-P2-CONSOLE-LOGS | 38 `console.*` en `src/` llegan a producción |
| PWA-P2-EMPTY-CATCH | ~19 bloques `catch` vacíos/silenciosos |
| PWA-P2-TOKEN-STORAGE | Refresh token en localStorage (App: SecureStore). `isAuthenticated()` solo verifica presencia, no expiración. Sin floor 24h local session. |
| PWA-P2-CSP-MISSING | `next.config.ts` sin CSP (AGENTS.md y README dicen que sí hay) |
| PWA-P2-TESTS-MISSING | No hay `npm test` real (scripts documentados pero no existen). No CI. |
| PWA-P2-BARCODE-BROKEN | `barcode-question.tsx` llama `detector.detect(video)` sin esperar `loadeddata` → siempre falla |
| PWA-P2-RBAC-MISSING | Permisos en tipo User pero sin enforcement client-side (App: `lib/auth/guards.ts`) |

---

## Registro de incidentes resueltos

| Fecha | Incidente | Fix | Commit |
|-------|-----------|-----|--------|
| 2026-09-26 | SW auth cache exposure | Excluir `/api/backend/`, purgar en logout, ExpirationPlugin, bump v5 | `fix(sw): secure api cache` |
| 2026-09-26 | Credencial dev en repo | Rotada, removida de `PROJECT_STATUS.md` | `chore(sec): rotate dev cred` |

---

## Referencias cruzadas

- `./07-known-bugs.md` — Catálogo vivo de bugs (fuente de verdad para guardrails)
- `./guardrails.md` — Detectores automáticos para evitar recurrencia
- `brigadaApp/ai-context/07-known-bugs.md` — Catálogo móvil (histórico de fixes a replicar)