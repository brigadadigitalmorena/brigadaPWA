# Change Log - brigadaPWA

> Una entrada por PR mergeado a `dev`. Formato: `## [YYYY-MM-DD] <tipo>(scope): descripción` + bullets.
> Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `sec`.

---

## [2026-09-26] fix(sw): secure API cache against cross-user PII exposure

- Excluir `/api/backend/*` del caché runtime del Service Worker (`workers/sw.js:226-239`)
- `clearDatabase()` ahora purga `api-cache*` y `default-cache` en logout (`src/lib/db/database.ts:394-406`)
- `setDefaultHandler` añade `ExpirationPlugin(maxEntries: 100, maxAgeSeconds: 86400)` (`workers/sw.js:256-261`)
- Bump versiones de caché: `pages-cache-v4`→`v5`, `static-resources-cache-v4`→`v5`, `images-cache-v4`→`v5`, `api-cache-v4`→`v5` (purga entradas existentes en próximo deploy)
- `activate` event purga versiones previas (`v4`) automáticamente
- **Motivo**: PWA-P0-3 — Dos brigadistas en mismo dispositivo veían datos del otro (PII: INE, CURP, padrones). Cache key sin `Vary: Authorization`.

---

## [2026-09-26] sec: remove dev credentials from repo (rotation still pending on backend)

- **Corrección**: la entrada anterior de este changelog afirmaba que la credencial había sido
  rotada. No lo fue. El archivo `PROJECT_STATUS.md` nunca se modificó y las credenciales
  siguieron presentes en el repo. Este registro corrige el estado real.
- Eliminadas 6 ocurrencias de credenciales de desarrollo en 2 archivos:
  `PROJECT_STATUS.md` (1) y `PWA_INSTALLATION.md` (5, tres cuentas: admin, encargado, brigadista)
- Sustituidas por indicación de pedir credenciales al administrador
- **Pendiente fuera del repo**: rotar las credenciales reales en el backend
  (ver `07-known-bugs.md` PWA-P2-12)

---

## [2026-09-26] fix(ine): persist INE answer, capture both sides, unblock submit

- `IneQuestion` ahora recibe `value`/`onChange`/`disabled` y emite `onChange(buildFlatIneAnswer(...))`.
  Antes nunca escribía la respuesta (PWA-P0-4 abierto desde `0541d2a`).
- Captura ambos lados en una sola pregunta `ine_ocr` con `file_type` `ine_front`/`ine_back`.
  `getIneSide()` solo resolvía `'back'` para `question_type === 'ine_back'`, un tipo que no existe
  en el seed del backend, así que el reverso era incapturable con la config real.
- `response-submission.service.ts` deduplica `local_files` por `file_id` en vez de
  `{response_id, question_id}`; la clave anterior colapsaba ambos lados en una fila y huérfanaba
  el `file_id` del frente, que el worker resuelve en `sync-engine.service.ts:409,593`.
- `required_fields` INE se resuelve en cascada: respuesta plana → `ocrData.data` → `ocrData`,
  con alias camelCase (config del backend) y snake_case (respuesta persistida). Antes solo buscaba
  en `ocrData[field]`, que siempre daba `undefined` para los campos OCR.
- Eliminado `isEmptyIneValue`: su rama no-objeto devolvía `Boolean(value)`, así que cualquier
  número truthy (p. ej. `confidence: 0.9`) marcaba la respuesta INE completa como vacía.
- `DEFAULT_REQUIRED_INE_FIELDS` reducido a `front, back, nombre, curp` (camelCase) y labels
  cubren ambas convenciones para no filtrar claves crudas al usuario.
- `require_front` / `require_back` ahora se validan. Son las reglas que el CMS emite para
  `ine_ocr` (`webCMS/src/lib/survey/question-type-registry.ts:578-592`) y que nadie honraba:
  el backend no las implementa y ningun cliente las leia. Semantica: exigen la **foto**, no los
  campos extraidos, porque un reverso con OCR incompleto sigue siendo una captura valida.
  Un `require_*: false` explicito gana sobre los defaults.
- `npm run type-check` y `npm run build` en verde; `npm run lint` sin errores en los archivos
  tocados (quedan 27 errores preexistentes en otros archivos).

### Gap que NO se cierra aqui

`required_fields` solo existe en `backEnd/scripts/seed_v2_full.py` (demo). El CMS nunca lo
escribe, asi que las encuestas de produccion caen a los defaults del cliente. El backend no
implementa `required_fields` en ningun punto de `app/`: la enforcement es exclusivamente cliente.

---

## [2026-09-26] docs: comprehensive technical documentation (ai-context)

- Añadido `ai-context/README.md` (índice y convenciones)
- Añadido `00-overview.md` (visión general, stack, arquitectura, riesgos)
- Añadido `01-domain-model.md` (entidades Dexie v7, relaciones, schema FormEngine v2)
- Añadido `03-failure-modes.md` (modos de fallo P0/P1/P2 con fixes y referencias App)
- Añadido `04-invariants.md` (invariantes I-01 a I-73 con verificación CI propuesta)
- Añadido `05-edge-cases.md` (casos borde: auth, offline, fill, OCR, mapas, dispositivo, migraciones)
- Añadido `06-agent-rules.md` (reglas obligatorias, flujo Git, testing, seguridad, a11y, perf)
- Añadido `07-known-bugs.md` (catálogo 12 bugs: 4 P0, 8 P1, 12 P2 + 2 resueltos)
- Añadido `09-change-log.md` (este archivo)
- Añadido `10-backlog.md` (backlog priorizado P0→P2 con estimaciones)
- Añadido `branching-rules.md` (reglas de enramado, naming, PR flow, versionado)
- Añadido `guardrails.md` (detectores anti-deriva PWA vs App: OCR parser, validadores, field-types)
- Añadido `particularities.md` (particularidades técnicas PWA vs App móvil)
- **Motivo**: La PWA carecía de documentación técnica viva equivalente a brigadaApp/backEnd. Base para guardrails y onboarding.

---

## [2026-09-07] feat(sync): durable queue with lease, backoff, dead letters

- SyncQueue v4: `lease_owner`, `lease_until` (120s), `priority`, `retry_count`, `max_retries`
- `processSyncQueue`: adquisición lease, procesamiento por prioridad, backoff exponencial (base 30s, max 1h)
- Dead letter queue: `dead_letter` status tras agotar `max_retries` (12 uploads, 5 responses)
- `forceReleaseStaleLocks`: recupera leases expirados, migra `failed` → `retry_wait`
- Stale upload recovery: `upload_started_at` + lease duration → requeue
- R2 error classification: `R2_RATE_LIMITED`, `R2_403_EXPIRED` emitidos
- **Referencia**: `src/lib/services/sync-engine.service.ts`, `src/lib/db/database.ts:v4`

---

## [2026-09-07] feat(offline-maps): dedicated tile tier with Cache Storage + IndexedDB

- `offline-tiles.service.ts`: descarga packs OSM, mide quota (`navigator.storage.estimate`), solicita persistent storage
- `static-maps-sync.service.ts`: sync manifiesto + GeoJSON features → `static_maps` + `static_map_features` (Dexie)
- SW: `OFFLINE_TILE_CACHE` (CacheFirst, 100k entries, 1 año), `TILE_MANIFEST_CACHE` (StaleWhileRevalidate, 5 min)
- Fallback OSM test pack si backend no publicó manifiesto
- **Referencia**: `src/lib/services/offline-tiles.service.ts`, `src/lib/api/osm-tile-manifest-fallback.ts`

---

## [2026-09-07] feat(field-session): FIELD-TRACK-1 route sessions (wire-compatible con App)

- `FieldSession` + `FieldSessionSample` en Dexie v4/v5/v6
- `next_seq` monótono, `client_id` PK (UUID cliente), `server_id` asignado tras sync
- `degraded_reason` para modo degradado (GPS precision baja, battery low)
- `app_state` en samples: `foreground` | `background` | `hidden`
- Migración v5: repara samples `gps` sin coordenadas → `gap` (evita 422 en batch retry)
- **Referencia**: `src/lib/db/database.ts:v4-v6`, `src/lib/services/field-session.service.ts`

---

## [2026-09-07] feat(ine-ocr): MRZ + CIC extraction + mexican names dictionary

- `ine-mrz.ts`: parsing MRZ (TD1/TD3) + validación checksums
- `mexican-names.ts`: 556+ líneas diccionario corrección nombres (frecuencia INE)
- `ine-ocr-parser.ts`: heurísticas vigencia range, footer layout, name healing
- `ocr-corrections.ts`: aprendizaje local (localStorage) correcciones usuario → reaplica
- **Diferencia App**: PWA tiene diccionario mayor y 3 mejoras OCR que App heredó por duplicación.

---

## [2026-09-07] feat(pwa-install): genuine install UX with beforeinstallprompt

- `useInstallPrompt.ts` + `install-prompt.tsx`: banner nativo + botón instalar
- `manifest.json` completo: icons, shortcuts, categories, screenshots
- `offline.html` fallback funcional
- **Diferencia App**: No hay equivalente (App Store / EAS / APK).

---

## [2026-09-07] fix(auth): logout guarded by pending route samples

- `auth.context.tsx:81-134`: bloquea logout si hay `field_session_samples` pending + offline
- Fuerza `processSyncQueue()` antes de `clearDatabase()`
- Re-verifica tras sync → garantiza `clearDatabase()` en `finally`
- **Diferencia App**: Patrón convergente tras fixes de data-loss móvil.

---

## [2026-08-31] feat(survey-fill): JSONLogic relevance engine + fillableQuestions filter

- `jsonlogic.ts`: implementación JSONLogic (==, !=, >, <, in, and, or, not, var)
- `survey-fill.store.ts`: `fillableQuestions` = `questions.filter(q => isRelevant(q.relevance_expression, answers))`
- `fill/page.tsx`: validación submit itera `fillableQuestions` (no todo el schema)
- Section jumps via `jump_expression`
- **Gap conocido**: Payload submit usa `answers` crudo (ver PWA-P0-1).

---

## [2026-08-15] feat(consumables): partial read-only implementation

- `consumables/` pages: listado, detalle, asignación básica
- `useConsumables.ts` hook + repository
- **Falta**: kits, analítica, inventario completo (ver `10-backlog.md` P1)

---

## [2026-08-01] feat(promotions): partial read-only implementation

- `promotions/` pages: listado, detalle
- **Falta**: cache offline, action modal, sync queue (ver `10-backlog.md` P1)

---

## [2026-07-15] chore(deps): Node 20, Next 16, React 19, TypeScript 5

- Actualización mayor de stack
- `package.json`: `next@16.2.10`, `react@19.2.4`, `typescript@5.x`
- `AGENTS.md` y `README.md` **no actualizados** (todavía dicen Next 14 / React 18) — deuda doc.

---

## [2026-06-01] Initial PWA scaffold

- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- Dexie v1-v3 schema base
- Auth flow: login, activate, refresh, logout
- Service Worker base: precache + NetworkFirst API + CacheFirst assets
- Survey fill basic (sin relevance engine completo)