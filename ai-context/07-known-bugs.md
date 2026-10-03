# Bugs Conocidos - brigadaPWA

> **Catálogo vivo**. Cada entrada tiene ID trazable: `PWA-P<severidad>-<SHORT>`. Severidad: P0 (catastrófico), P1 (mayor), P2 (menor).
> Fuente: Auditoría técnica 2026-09-26 vs brigadaApp (`brigadaApp/ai-context/07-known-bugs.md`).

---

## P0 - Catastrófico (datos, privacidad, bloqueo total)

### PWA-P0-1 — Hidden answers submitted → guaranteed `form_engine_violation` dead-letters
- **Archivo**: `src/app/(dashboard)/surveys/[id]/fill/page.tsx:235`
- **Síntoma**: Usuario responde Q1="Sí" → Q2 aparece → responde Q2 → cambia Q1="No" → finaliza. Backend rechaza toda la respuesta con `form_engine_violation`. Reintentos fallan igual → `dead_letter`.
- **Causa**: `finalizeResponse({ answers, ... })` usa store `answers` crudo (todas las claves escritas). Validación cliente usa `fillableQuestions` filtrado por relevancia. `setAnswer` nunca borra claves.
- **Fix**: Payload = `fillableQuestions.map(q => ({ [key]: answers[key] }))`. En replay: detectar `form_engine_violation` → podar respuestas de preguntas no visibles → reintentar 1 vez.
- **Referencia App**: `MOB-HIDDEN-FIELD-SUBMIT-2026-05-17` (crítico), `MOB-HIDDEN-FIELD-REPLAY-2026-05-18` (fix replay).
- **Estado**: 🔴 Abierto

---

### PWA-P0-2 — Error copy promete "Corregir respuesta" pero no existe la acción
- **Archivo**: `src/lib/sync/error-copy.ts:97,103` → `src/components/sync/submission-history.tsx`
- **Síntoma**: Toast/error dice *"Toca Corregir respuesta para volver a la encuesta y ajustar el dato marcado."* Usuario busca botón → no existe. Solo "Cargar más". Opciones: reintentar (mismo fallo) o descartar (pérdida silenciosa).
- **Causa**: Copy escrito asumiendo flujo de corrección que no se implementó.
- **Fix**: Implementar acción "Corregir respuesta" (navega a fill con respuesta precargada) **O** cambiar copy a "Descartar y volver a capturar".
- **Referencia App**: `MOB-SUBMIT-CORRECTION-FLOW-2026-05-15` (crítico).
- **Estado**: 🔴 Abierto

---

### PWA-P0-3 — Service Worker cachea API autenticada sin `Vary: Authorization`
- **Archivo**: `workers/sw.js:226-239`, `src/lib/db/database.ts:394-406`
- **Síntoma**: Dos brigadistas en mismo dispositivo. A hace login → ve padrones. Cierra sesión. B hace login → ve datos de A (padrones, respuestas, hogares) por 5 min en `api-cache`. Logout no purga caché. `default-cache` sin `ExpirationPlugin` → crecimiento ilimitado.
- **Causa**: `NetworkFirst` para todo `GET /api/*` (incluye `/api/backend/*` proxy autenticado). Clave = URL only. `clearDatabase()` solo limpia IndexedDB.
- **Fix aplicado 2026-09-26**:
  - Excluir `/api/backend/` del caché SW
  - `clearDatabase()` purga `api-cache*` y `default-cache`
  - `setDefaultHandler` con `ExpirationPlugin(maxEntries: 100, maxAgeSeconds: 86400)`
  - Bump `api-cache-v4` → `v5` purga entradas existentes
- **Referencia App**: N/A (App usa AsyncStorage + SecureStore, no SW)
- **Estado**: 🟡 Parcial (deploy pendiente para confirmar en prod)

---

### PWA-P0-4 — INE OCR nunca escribe respuesta (`onChange` omitido)
- **Archivo**: `src/components/survey/QuestionTypes/ine-question.tsx:18`
- **Síntoma**: Usuario captura INE frente/reverso → OCR extrae CURP, nombre, domicilio → UI muestra datos → finaliza encuesta → respuesta enviada **sin** campo INE.
- **Causa**: `Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>`. Componente no recibe `onChange` ni `value`. Guarda en estado local, nunca llama `onChange(buildFlatIneAnswer(...))`.
- **Causa secundaria**: `getIneSide()` solo devolvía `'back'` para `question_type === 'ine_back'`, pero el contrato real del backend es **una** pregunta `ine_ocr` que exige `front` **y** `back` (`backEnd/scripts/seed_v2_full.py:406-428`). Con la config de producción el reverso nunca era capturable.
- **Causa terciaria**: `response-submission.service.ts` deduplicaba `local_files` por `{response_id, question_id}`, colapsando `ine_front` + `ine_back` en una fila y huérfanando el `file_id` del frente (el worker resuelve blobs por `file_id`).
- **Fix aplicado**: el componente recibe `value`/`onChange`/`disabled`, captura ambos lados con `file_type` `ine_front`/`ine_back`, y emite `onChange(buildFlatIneAnswer(...))`; el dedup pasa a ser por `file_id`.
- **Referencia App**: `brigadaApp/components/survey/ine-question.tsx:310,470-479` (llama `onChange`).
- **Estado**: 🟢 Resuelto (PR #5)

---

## P1 - Mayor (funcionalidad core rota, reintentos infinitos, datos incompletos)

### PWA-P1-1 — Validación cliente 20/48 reglas del backend
- **Archivo**: `src/lib/forms/validate-answer.ts` (262 líneas) vs `brigadaApp/lib/forms/validation.ts` (784 líneas, 48 reglas)
- **Reglas faltantes**:
  - GIS: `min_area_m`, `max_area_m`, `min_accuracy_m`, `max_accuracy_m`, `require_altitude`, `max_distance_m`, `min_points`, `max_points`
  - Multimedia: `max_size_mb`, `allowed_formats`, `allowed_mimes`, `formats`, `max_duration_s`
  - Tiempo: `min_time`, `max_time`, `min_datetime`, `max_datetime`, `step`
  - Tipos: `types`
  - INE: `required_fields` — **implementado** en PR #5 (ver nota de contrato abajo)
  - Normalización: `normalize_trim`, `normalize_uppercase`, `normalize_lowercase`, `normalize_strip_accents`, `normalize_remove_spaces`, `normalize_alpha_numeric`, `normalize_phone`
- **Contrato INE (PR #5)**: `required_fields` se resuelve en cascada sobre la respuesta plana, `ocrData.data` y `ocrData`, aceptando alias camelCase (config del backend) y snake_case (respuesta persistida). Los defaults del cliente se redujeron a `front, back, nombre, curp` (desviación deliberada frente a los 13 de la App); el seed del backend sigue configurando 13 campos, y esos mandan porque el cliente no ignora la config de la oficina.
- **Impacto**: Validación pasa en cliente → falla en backend → reintentos queman `max_retries` → `dead_letter`. Divergencia silenciosa (sin `normalize_*` texto crudo).
- **Fix**: Portar reglas faltantes a módulo compartido o replicar. Añadir `normalizeAnswerByRules`.
- **Referencia App**: `MOB-TYPE-RULE-VALIDATION-2026-05-14`, `MOB-SUBMIT-VALIDATION-PARITY-2026-05-15`.
- **Estado**: 🟡 Parcial (`required_fields` INE hecho; faltan GIS, multimedia, tiempo, `types` y `normalize_*`)

---

### PWA-P1-2 — Parser OCR 888 líneas detrás (18 funciones de endurecimiento CURP/Clave)
- **Archivo**: `src/lib/ocr/ine-ocr-parser.ts` (2,732 L) vs `brigadaApp/lib/ocr/ine-ocr-parser.ts` (3,247 L)
- **Funciones ausentes**: `extractCurpCandidates`, `scoreCurpCandidate`, `pickBestCurp`, `crossRepairClaveWithCurp`, `extractClaveElectorCandidates`, `pickBestClaveElector`, `scoreClaveCandidate`, `healNamesFromClave`, `extractSeccionFromBlocks`, `pickSeccionFromTokens`, `isClassicFooterLabelRow`, `looksLikeBirthYear`, `looksLikeCurpWindow`, `birthYearsInText`, `compactAlphanumeric`, `findWordStartingWith`, `lettersOnly` + constantes `CLAVE_ELECTOR_SPACED_RE`, `CLAVE_ELECTOR_STRICT_RE`, `FECHA_SPACED_RE`.
- **Impacto**: Un carácter mal leído en CURP → extracción falla completamente (App pre-`4fb63e4`). MRZ valida contra CURP extraído → cascada de fallos.
- **Fix**: Portar 18 funciones + tests. Guardrail CI para detectar divergencia.
- **Referencia App**: `4fb63e4` "feat(ocr): harden INE CURP/Clave de Elector extraction" (2026-09-26).
- **Estado**: 🔴 Abierto

---

### PWA-P1-3 — Subida archivos sin exclusión mutua cross-tab
- **Archivo**: `src/lib/services/sync-engine.service.ts:56` (`inFlightUploads` module-level `Set`)
- **Síntoma**: Dos pestañas abiertas → ambas procesan cola → mismo `file_id` subido concurrentemente → duplicados en backend.
- **Fix**: `BroadcastChannel` o lock IndexedDB (`acquireProcessLock` patrón) para single-flight cross-tab.
- **Referencia App**: `MOB-ONLINE-MEDIA-DUPLICATE-2026-05-16` (crítico).
- **Estado**: 🔴 Abierto

---

### PWA-P1-4 — Sync acoplado a ciclo de vida React (sin singleton)
- **Archivo**: `src/contexts/sync.context.tsx:45-216`
- **Síntoma**: NetInfo listeners, `setInterval`, `visibilitychange`/`focus`, mensajería SW en contexto React. Múltiples instancias/unmount prematuro = race conditions.
- **Fix**: Extraer `syncOrchestrator` singleton (fuera de React).
- **Referencia App**: `lib/services/sync-orchestrator.service.ts`, `MOB-SYNC-UI-LIFECYCLE-2026-05-17` (crítico).
- **Estado**: 🔴 Abierto

---

### PWA-P1-5 — Clasificador errores upload incompleto
- **Archivo**: `src/lib/services/sync-engine.service.ts:518-523` emite `R2_RATE_LIMITED`, `R2_403_EXPIRED` → **sin entrada en `error-copy.ts`** → texto genérico.
- **Fix**: Añadir entradas en `error-copy.ts` + `classifyUploadError()` (App: `lib/sync/upload-error-utils.ts`, `MOB-R2-403-ALL-EXPIRED-2026-06-11`).
- **Estado**: 🔴 Abierto

---

### PWA-P1-6 — `read_only` / `calculated` / `data_list` honrados asimétricamente
- **Archivos**: `src/lib/survey/field-types.ts:33-45`, `src/components/survey/QuestionTypes/question-renderer.tsx:9`
- **Síntomas**: `read_only` renderiza editable. `data_list` cae en renderer no soportado (importa `DataListQuestion` y nunca lo despacha). `calculated_expression` evaluado pero no bloqueado.
- **Fix**: Despachar `DataListQuestion`. Alinear `field-types.ts` con App. Renderers respetan `read_only`/`calculated`.
- **Referencia App**: `brigadaApp/lib/forms/field-types.ts`, `QuestionRenderer`.
- **Estado**: 🔴 Abierto

---

### PWA-P1-7 — `requires_active_session` default discrepa → bloqueo duro
- **Archivo**: `src/hooks/use-field-session-gate.ts`
- **Síntoma**: PWA bloquea en valores desconocidos cuando tracking habilitado. App: default unknown → `warn`.
- **Fix**: Alinear default a `warn`. `app-config.service.ts` declara `notifications` habilitado sin ruta → dead gate config.
- **Estado**: 🔴 Abierto

---

### PWA-P1-8 — Escaneo código de barras estructuralmente roto
- **Archivo**: `src/components/survey/QuestionTypes/barcode-question.tsx:43`
- **Síntoma**: `detector.detect(video)` llamado **una vez** tras `await video.play()`. Primer frame no disponible → `[]` → "No se detectó ningún código".
- **Fix**: Loop con `requestVideoFrameCallback` / `loadeddata` wait + polling. Chequeo `secure-context` (falla en HTTP LAN).
- **Referencia App**: `brigadaApp/components/survey/ine-camera.ts` (loop robusto).
- **Estado**: 🔴 Abierto

---

### PWA-P1-9 — Almacenamiento tokens contradice docs y carece floor 24h
- **Archivos**: `src/lib/api/client.ts:34-57`, `src/lib/api/auth.service.ts`, `AGENTS.md:47`
- **Realidad**: Access + Refresh **ambos en localStorage** (docs dicen refresh en sessionStorage). `isAuthenticated()` solo verifica presencia, no expiración. Sin floor 24h local session (App: `MOB-SESSION-24H-FLOOR-2026-05-14` crítico). Sin CSP/HSTS/Permissions-Policy.
- **Fix**: Mover refresh a storage no persistente (sessionStorage only), añadir verificación expiración + floor 24h, implementar CSP.
- **Estado**: 🔴 Abierto

---

## P2 - Menor (calidad, higiene, entrega)

| ID | Título | Archivo | Detalle |
|----|--------|---------|---------|
| PWA-P2-1 | Storage sin tope | `offline-tiles.service.ts:96-113` | Mide quota pero no aplica cap (App: 200MB + cleanup 6h + rutas protegidas) |
| PWA-P2-2 | Console logs en prod | `src/` (38 ocurrencias) | Sync progress logging llega a producción |
| PWA-P2-3 | Empty catch blocks | ~19 archivos | `ExpressionEvaluator.ts:194`, `datasets.service.ts:92`, `sync-engine.service.ts:456,474`, `survey-version.ts:189` |
| PWA-P2-4 | OCR corrections en localStorage sin cifrar | `ocr-corrections.ts:47` | OK en dispositivo personal, exposición en dispositivo compartido |
| PWA-P2-5 | `npm test` no existe | `package.json:11-12` | Scripts documentados en AGENTS.md/README pero no implementados. No CI. |
| PWA-P2-6 | Barcode question broken | `barcode-question.tsx:43` | Ver PWA-P1-8 |
| PWA-P2-7 | RBAC client-side ausente | — | Permisos en tipo User sin enforcement (App: `lib/auth/guards.ts`) |
| PWA-P2-8 | `as any` casts | `ine-ocr-parser.ts:1993,2698` | Dos casts, sin `@ts-ignore` |
| PWA-P2-9 | ZIP autocomplete "Missing" en heatmap pero componente existe | `zip-autofill-question.tsx` | Dos inputs sin índice SEPOMEX (App: `lib/zip-cache.ts` + `ZipAutocompleteField.tsx`) → **Partial**, no Missing |
| PWA-P2-10 | Lockfiles duplicados | `bun.lock` + `package-lock.json` | Igual que App. npm es canónico (AGENTS.md). |
| PWA-P2-11 | Dockerfile corre `npm run dev` | `Dockerfile` | No multi-stage, no `npm run start` |
| PWA-P2-12 | Credenciales dev en repo | `PROJECT_STATUS.md`, `PWA_INSTALLATION.md` | Eliminadas del repo en PR #5 (6 ocurrencias, 3 cuentas). **Pendiente del administrador**: rotar las credenciales reales en el backend, ya que la rotación no se puede hacer desde el repo. |

---

## Resueltos / Cerrados

| ID | Título | Fix | Commit | Fecha |
|----|--------|-----|--------|-------|
| PWA-P0-3 | SW auth cache exposure | Excluir `/api/backend/`, purge en logout, ExpirationPlugin, bump v5 | `fix(sw): secure api cache` | 2026-09-26 |
| — | Credencial dev en repo | Rotada, removida de `PROJECT_STATUS.md` | `chore(sec): rotate dev cred` | 2026-09-26 |

---

## Convención de IDs

`PWA-P<severidad>-<NNN>` donde severidad: 0=P0, 1=P1, 2=P2. NNN correlativo por severidad.

**Referencias cruzadas**:
- `./03-failure-modes.md` — Análisis de modos de fallo
- `./guardrails.md` — Detectores automáticos para evitar recurrencia
- `brigadaApp/ai-context/07-known-bugs.md` — Catálogo móvil (162 líneas, ~100 entradas)