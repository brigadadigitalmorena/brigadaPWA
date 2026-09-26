# Invariantes - brigadaPWA

Estas son reglas que **nunca deben romperse**. Cualquier PR que viole una invariante debe ser rechazado en CI/review.

## Datos y sincronización

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-01 | **Toda escritura pasa por Dexie + sync_queue**. No hay escrituras directas a API sin encolar. | `sync-engine.service.ts`, `survey.service.ts` |
| I-02 | **`response_id` (client_id) es UUID v4 generado en cliente**. Nunca se usa ID del backend antes de sync. | `uuid.ts`, `fill/page.tsx` |
| I-03 | **`sync_queue.lease_until` ≤ ahora + 120s**. Leases expiran y se reponen a `pending`. | `database.ts:getLeaseDurationMs()`, `forceReleaseStaleLocks()` |
| I-04 | **`max_retries` respetado**: 12 para `UPLOAD_FILE`, 5 para `CREATE_RESPONSE`. Tras agotar → `dead_letter`. | `sync-engine.service.ts:MAX_RETRIES` |
| I-05 | **`dead_letter` nunca se reintenta automáticamente**. Requiere acción manual (retry UI o discard). | `sync-engine.service.ts`, `submission-history.tsx` |
| I-06 | **Integridad de respuesta**: `integrity_hash` = SHA-256(`answers_json` + `files` ordenados). Verificado en backend. | `fill/page.tsx`, `Response` interface |
| I-07 | **`immutable: true` → respuesta no editable**. UI bloquea edición, sync ignora updates. | `Response` interface, `survey-detail/page.tsx` |
| I-08 | **FieldSession `next_seq` es monótono y nunca se reutiliza**. `session_client_id + sample_seq` único. | `field-session.service.ts`, `FieldSessionSample` index |

## Autenticación y tokens

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-11 | **Access token → localStorage**. Refresh token → sessionStorage **y** localStorage (fallback). | `auth.service.ts`, `client.ts` |
| I-12 | **`isAuthenticated()` verifica presencia + expiración** (no solo presencia). Floor 24h local session. | `auth.service.ts:isAuthenticated()` |
| I-13 | **Logout atómico**: `logoutApi()` → `clearDatabase()` → limpiar tokens → `setState`. En `finally`. | `auth.context.tsx:logout()` |
| I-14 | **Logout bloqueado si hay muestras de recorrido pendientes** y offline. | `auth.context.tsx:81-98` |

## Service Worker y caché

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-21 | **`/api/backend/*` NUNCA cacheado en SW**. Tráfico autenticado pasa directo a red. | `workers/sw.js:226-239` |
| I-22 | **`default-cache` tiene `ExpirationPlugin` con `maxEntries` y `maxAgeSeconds`**. Sin crecimiento ilimitado. | `workers/sw.js:256-261` |
| I-23 | **Cachés versionados**: bump en cada cambio de estrategia. `activate` purga versiones previas. | `workers/sw.js:320-343` |
| I-24 | **Logout purga `api-cache*` y `default-cache`** además de IndexedDB. | `database.ts:clearDatabase()` |

## Formularios y validación

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-31 | **Payload de respuesta = solo preguntas visibles** (`fillableQuestions`). Nada de claves huérfanas. | `fill/page.tsx:finalizeResponse` |
| I-32 | **Relevancia evaluada con JSONLogic** idéntico al backend. `jsonlogic.ts` sincronizado con `seed_local.py`. | `survey-fill.store.ts`, `jsonlogic.ts` |
| I-33 | **Validación cliente ⊇ validación backend** (paridad ≥). Nunca menos reglas. | `validate-answer.ts` vs `brigadaApp/lib/forms/validation.ts` |
| I-34 | **Normalización aplicada antes de enviar**: `normalizeAnswerByRules` por regla `normalize_*`. | `validate-answer.ts` (pendiente) |

## OCR e INE

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-41 | **INE pregunta SIEMPRE llama `onChange`** con respuesta estructurada al completar ambos lados (o lado único si config). | `ine-question.tsx` |
| I-42 | **MRZ validado contra diccionario mexicano** (`mexican-names.ts`) antes de `onChange`. | `ine-mrz.ts`, `mexican-names.ts` |
| I-43 | **Correcciones OCR guardadas en `localStorage`** (clave `ine-ocr-corrections:{curp}`) y reaplicadas. | `ocr-corrections.ts` |

## Mapas offline

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-51 | **Tiles OSM cacheados solo bajo `/tiles/osm/`** con `CacheFirst` + TTL 1 año. | `workers/sw.js:161-175` |
| I-52 | **Manifiesto de tiles (`/manifest`) SIEMPRE `StaleWhileRevalidate` TTL 5 min**. | `workers/sw.js:179-191` |
| I-53 | **Packs offline descargados → IndexedDB (`static_maps` + `static_map_features`)**. SW sirve desde Cache Storage. | `static-maps-sync.service.ts`, `offline-tiles.service.ts` |

## Rendimiento y límites

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-61 | **Componentes ≤ 200 líneas**. Si supera, dividir. | ESLint `max-lines` (configurar) |
| I-62 | **Bundle inicial < 200KB gzipped**. Code-splitting por ruta. | `next.config.ts`, `npm run build` |
| I-63 | **IndexedDB ≤ 200MB**. Limpieza automática cada 6h (tiles antiguos, blobs subidos). | `offline-tiles.service.ts` (pendiente tope) |

## Accesibilidad

| Inv# | Invariante | Dónde se verifica |
|------|------------|-------------------|
| I-71 | **Semántica HTML**: `<button>`, `<label for>`, `<fieldset>`, heading order. | Manual + axe-core en CI (pendiente) |
| I-72 | **Contraste WCAG 2.1 AA** (4.5:1 normal, 3:1 large). | Tailwind `text-*` + `bg-*` auditados |
| I-73 | **Navegación por teclado**: focus visible, skip links, trap en modales. | shadcn/ui + pruebas manuales |

---

## Cómo validar en CI (pendiente implementar)

```yaml
# .github/workflows/invariants.yml (propuesto)
jobs:
  invariants:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Check I-21 (no /api/backend/ in SW cache)
        run: ! grep -q "url.pathname.startsWith('/api/')" workers/sw.js || (grep -q "!url.pathname.startsWith('/api/backend/')" workers/sw.js && exit 0) || exit 1
      - name: Check I-22 (default-cache has ExpirationPlugin)
        run: grep -A5 "setDefaultHandler" workers/sw.js | grep -q "ExpirationPlugin"
      - name: Check I-03 (LEASE_MS = 120000)
        run: grep -q "LEASE_MS = 120_000" src/lib/db/database.ts
      - name: Check I-31 (payload from fillableQuestions)
        run: grep -q "fillableQuestions" src/app/\(dashboard\)/surveys/\[id\]/fill/page.tsx
      - name: Check I-41 (ine-question has onChange)
        run: grep -q "onChange" src/components/survey/QuestionTypes/ine-question.tsx
```

---

## Excepciones documentadas

| Inv# | Excepción | Justificación | Expira | Dueño |
|------|-----------|---------------|--------|-------|
| I-33 | Validación cliente 20/48 reglas | Gap conocido, plan de paridad en Fase 2 | 2026-12-31 | Equipo PWA |
| I-63 | Sin tope 200MB en storage | `offline-tiles.service.ts` mide pero no aplica | 2026-10-31 | Equipo PWA |

> **Regla**: Toda excepción debe tener fecha de expiración y dueño. Al expirar, el PR que la renueva debe incluir plan de remediación.