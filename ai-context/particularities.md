# Particularidades Técnicas - brigadaPWA

> Documenta lo que es **único, diferente o contraintuitivo** en la PWA vs la app móvil o vs expectativas estándar web. Sirve como "tribal knowledge" escrito para onboarding y debugging.

---

## 1. Arquitectura híbrida: Next.js + Dexie + SW + Proxy API

La PWA **no habla directo al backend**. Todo el tráfico API pasa por un proxy catch-all Next.js:

```
Browser → /api/backend/[...path] → Next.js Route Handler → FastAPI backend
```

**Implicaciones**:
- Service Worker ve **todo** como `/api/backend/*` (auth, surveys, files, tiles, maps)
- No hay `rewrites` en `next.config.ts` — el proxy es código (`src/app/api/backend/[...path]/route.ts`)
- Cookies/headers se reenvían manualmente en el proxy
- CORS resuelto en servidor (browser no ve backend directo)
- **Riesgo**: SW cachea `/api/backend/*` → expone PII cross-user (ver PWA-P0-3, fix aplicado)

---

## 2. Dual token storage: localStorage + sessionStorage (con bug)

```typescript
// src/lib/api/client.ts:34-57
access_token  → localStorage  (persistente)
refresh_token → localStorage  + sessionStorage (duplicado, bug doc)
```

**Por qué**: `sessionStorage` se limpia al cerrar pestaña, pero `localStorage` persiste. El código escribe en ambos por "compatibilidad", pero `AGENTS.md:47` dice solo sessionStorage. `isAuthenticated()` no verifica expiración.

**Fix pendiente**: Refresh solo en sessionStorage + verificación expiración + floor 24h.

---

## 3. Service Worker: tres capas de caché con semántica distinta

| Caché | Estrategia | Contenido | TTL / Límite |
|-------|------------|-----------|--------------|
| `pages-cache-v5` | NavigationRoute custom | HTML shells, `/surveys`, `/fill`, `/maps` | NetworkFirst + fallback offline.html |
| `static-resources-cache-v5` | StaleWhileRevalidate | CSS, JS, workers, fonts | 80 entries, 20 días |
| `images-cache-v5` | CacheFirst | Imágenes (incl. tiles OSM cacheados) | 60 entries, 30 días |
| `api-cache-v5` | NetworkFirst | **Solo APIs NO autenticadas** (excluye `/api/backend/`) | 50 entries, 5 min |
| `OFFLINE_TILE_CACHE` | CacheFirst | Tiles OSM versionados (`/tiles/osm/`) | 100k entries, 1 año |
| `TILE_MANIFEST_CACHE` | StaleWhileRevalidate | `/mobile/tiles/osm/manifest` | 5 entries, 5 min |
| `next-rsc-cache` | NetworkFirst | RSC payloads, prefetches | 100 entries, 24h |
| `google-fonts-cache` | StaleWhileRevalidate | fonts.googleapis.com / gstatic.com | 30 entries, 1 año |
| `default-cache` | NetworkFirst + ExpirationPlugin | **Catch-all** (todo lo no matcheado arriba) | 100 entries, 24h |

**Clave**: `default-cache` **tiene** `ExpirationPlugin` desde fix PWA-P0-3. Antes crecía sin límite.

---

## 4. Logout atómico con guardia de recorrido

`src/contexts/auth.context.tsx:81-134` es el patrón más robusto del código:

```typescript
const logout = async () => {
  // 1. Cierra sesión de recorrido activo
  const activeFieldSession = await fieldSessionService.getActiveSession();
  if (activeFieldSession) await fieldSessionService.endSession('logout');

  // 2. Si hay muestras pendientes Y offline → BLOQUEA logout
  const pendingRouteSamples = await db.field_session_samples.where('upload_status').equals('pending').count();
  if (pendingRouteSamples > 0 && !navigator.onLine) {
    throw new Error('Conéctate a internet antes de cerrar sesión.');
  }

  // 3. Si hay muestras pending → force sync ANTES de limpiar
  if (pendingRouteSamples > 0) await processSyncQueue();

  // 4. Re-verifica: si quedó trabajo sin sync → ERROR
  const unsyncedRouteWork = await db.sync_queue.filter(...).count();
  const remainingSamples = await db.field_session_samples.where('upload_status').equals('pending').count();
  if (unsyncedRouteWork > 0 || remainingSamples > 0) {
    throw new Error('No se pudo respaldar el recorrido. Reintenta sincronización.');
  }

  // 5. Solo AHORA: logout API + clearDatabase() + clear tokens + setState
  try { await logoutApi(); }
  finally {
    await clearDatabase();  // IndexedDB + SW caches (api-cache*, default-cache)
    setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  }
};
```

**Por qué importa**: Garantiza que **nunca** se pierda trabajo de recorrido al cerrar sesión. Patrón convergente con fixes móviles.

---

## 5. Survey Fill: dos fuentes de verdad temporales

En `fill/page.tsx` coexisten:

1. **`answers` (Zustand store)** — mapa completo `{ [question_key]: any }`. **Nunca borra claves**. `setAnswer(key, value)` solo agrega/actualiza.
2. **`fillableQuestions` (derived)** — `questions.filter(q => isRelevant(q.relevance_expression, answers))`. Preguntas **visibles ahora**.

**Bug crítico (PWA-P0-1)**: Validación usa `fillableQuestions` ✅, pero **submit serializa `answers` crudo** ❌.

**Fix**: `const payloadAnswers = Object.fromEntries(fillableQuestions.map(q => [questionKeyOf(q.question), answers[questionKeyOf(q.question)]]));`

---

## 6. INE OCR: captura legal sin persistencia de respuesta

`ine-question.tsx` es el único renderer que **omite `onChange` y `value`** intencionalmente (props: `Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>`).

**Flujo actual**:
1. Usuario fotografía frente → `recognizeIne(frontBlob)` → OCR → estado local `ocrFields`
2. Usuario fotografía reverso → `recognizeIne(backBlob)` → OCR → mergea `ocrFields`
3. UI muestra datos extraídos (CURP, nombre, domicilio, vigencia)
4. Usuario finaliza encuesta → **nada de eso llega al backend**

**Fix**: Recibir `onChange`, `value`. Al completar (ambos lados o uno si config): `onChange(buildFlatIneAnswer({ curp, nombre, domicilio, vigencia, ... }))`.

---

## 7. Sync Queue: lease-based, priority, dead-letter

`SyncQueue` (Dexie) no es FIFO simple:

| Campo | Propósito |
|-------|-----------|
| `status` | `pending` → `leased` → `syncing` → `completed` / `retry_wait` / `dead_letter` / `discarded` |
| `priority` | Menor = más urgente (0=crítico, 10=normal, 20=background) |
| `lease_owner` / `lease_until` | `pwa-<uuid8>` + 120s. Evita doble procesamiento. |
| `retry_count` / `max_retries` | 12 uploads, 5 responses. Backoff exponencial (base 30s, max 1h). |
| `last_error_code` | Código backend (`form_engine_violation`, `R2_403_EXPIRED`, etc.) para clasificación. |
| `upload_started_at` | Para stale upload recovery: si `now - upload_started_at > lease` → requeue. |

**Procesamiento** (`sync-engine.service.ts`):
1. `acquireProcessLock()` (KV lock global, 120s)
2. `forceReleaseStaleLocks()` (recupera leases expirados + migra `failed`→`retry_wait`)
3. Selecciona `pending` ordenados por `priority`, `next_retry_at`, `created_at`
4. Para cada: `status=leased`, `lease_owner=me`, `lease_until=now+120s`
5. Ejecuta operación (API call)
6. OK → `completed`, limpia lease
7. Error → clasifica → `retry_wait` con `next_retry_at` (backoff) o `dead_letter` si agotó retries
8. `releaseProcessLock()`

---

## 8. Field Sessions: wire-compatible con App móvil

`FieldSession` + `FieldSessionSample` en Dexie **esquema idéntico** a `brigadaApp` SQLite:

```typescript
// PK cliente (UUID), server_id asignado tras sync
client_id: string;          // PK
server_id?: number;         // Backend ID
activity_type: string;      // 'survey_route', 'audit', 'supervision'
next_seq: number;           // Monotónico, nunca reutiliza
sample_count: number;
distance_m: number;
// Samples: sample_seq, sample_type (gps|photo|gap), lat/lng, accuracy, app_state (fg|bg|hidden)
```

**Migración v5** (`database.ts:290-315`): Repara samples `gps` sin coordenadas → `gap` (evita 422 en batch retry).

**Migración v7** (`database.ts:336-362`): `assignment_json` → `entitlement_json` (rename).

---

## 9. Mapas offline: tres capas de almacenamiento

| Capa | Qué guarda | Dónde | TTL / Límite |
|------|------------|-------|--------------|
| **SW Cache Storage** | Tiles OSM (PNG/WebP) | `OFFLINE_TILE_CACHE` (CacheFirst) | 100k entries, 1 año |
| **IndexedDB (Dexie)** | Manifiesto + GeoJSON features (vector) | `static_maps`, `static_map_features` | Persistente, versionado |
| **KV Cache** | `tiles-manifest-etag`, `last-sync` | `kv_cache` (TTL) | 24h |

**Flujo descarga** (`static-maps-sync.service.ts`):
1. `GET /mobile/tiles/osm/manifest` → `manifest_etag` + lista packs
2. Para cada pack: `GET /mobile/tiles/osm/pack/{id}` → stream → Cache Storage
3. `GET /mobile/maps/manifest` → GeoJSON features → `static_map_features` (batch Dexie)
4. Actualiza `static_maps.synced_at`

**Fallback OSM test pack** (`osm-tile-manifest-fallback.ts`): Si backend 404 en manifiesto → sirve pack local de desarrollo (CDMX centro).

---

## 10. Tokens y sesión: floor 24h ausente

App móvil (`MOB-SESSION-24H-FLOOR-2026-05-14`): sesión local mínima 24h aunque token expire. PWA **no tiene**.

**Actual**:
```typescript
// auth.service.ts
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('brigada_access_token');  // Solo presencia
}
```

**Debe ser**:
```typescript
export function isAuthenticated(): boolean {
  const access = localStorage.getItem('brigada_access_token');
  const sessionStarted = sessionStorage.getItem('brigada_session_started_at');
  if (!access || !sessionStarted) return false;
  const hours = (Date.now() - new Date(sessionStarted).getTime()) / 3_600_000;
  return hours < 24;  // Floor 24h
}
```

---

## 11. Build y deploy: Dockerfile corre `dev`, no `start`

```dockerfile
# Dockerfile actual
CMD ["npm", "run", "dev"]  # ❌ Dev server en prod
```

**Debe ser multi-stage**:
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
CMD ["node", "server.js"]  # next.config.ts: output: 'standalone'
```

---

## 12. Testing: scripts documentados pero inexistentes

`package.json` y `AGENTS.md`/`README.md` dicen:
```json
"test": "vitest run",
"test:e2e": "playwright test"
```

**Realidad**: `vitest` y `playwright` **no instalados**. `npm test` falla. No CI.

**Archivos de test existentes**: solo `test:sync` y `test:campaigns` (scripts custom, no runner estándar).

---

## 13. Accesibilidad: gaps conocidos

| Gap | Detalle |
|-----|---------|
| Sin `axe-core` en CI | Solo manual |
| Focus visible inconsistente | Algunos botones shadcn pierden outline en dark mode |
| Skip links ausentes | No `href="#main-content"` en layout |
| ARIA en modales | `Dialog` de shadcn OK, pero modales custom (INE camera) faltan `role="dialog"`, `aria-modal` |
| Contraste en charts | MapLibre + tooltips custom pueden fallar 4.5:1 |

---

## 14. Internacionalización: hardcoded español

```typescript
// Ejemplos reales en código
toast.error('Faltan datos para finalizar la encuesta');
'No se detectó ningún código.'
'Hay puntos del recorrido sin enviar.'
```

**Sin i18n lib**. Strings en componente. Para multi-idioma futuro: extraer a `messages/es-MX.json` + `next-intl` o similar.

---

## 15. Observabilidad: cero en producción

| Herramienta | Estado |
|-------------|--------|
| Sentry | No configurado (DSN en env faltante) |
| PostHog / Mixpanel | No configurado |
| Logs estructurados | `console.log` plano (38 ocurrencias en `src/`) |
| Métricas Web Vitals | No |
| Error boundary | Solo `ErrorBoundary` genérico en layout, sin reporte |

---

## 16. Diferencias clave vs brigadaApp (resumen ejecutivo)

| Capacidad | brigadaApp (React Native) | brigadaPWA (Web) | Nota |
|-----------|---------------------------|------------------|------|
| Almacenamiento seguro | SecureStore (Keychain/Keystore) | IndexedDB + localStorage | Techo web |
| Push | Expo Push Service | Web Push (VAPID) - **no impl** | Sistemas distintos |
| Background Sync | Nativo | Background Sync API (solo Chromium) | **No perseguir** |
| Ubicación background | Soportado | Restringido (batería, permisos) | **No perseguir** |
| OCR | Tesseract nativo | Tesseract.js WASM | PWA: diccionario mayor |
| Mapas offline | SQLite + tiles | Dexie + Cache Storage + IndexedDB | PWA: tier dedicado |
| Instalación | App Store / EAS / APK | PWA install prompt | Flujo web nativo |
| Biometría | FaceID / TouchID | WebAuthn (distinto) | No core |
| Build | EAS / Gradle / Xcode | Next.js + npm | Simpler |

---

## 17. Archivos "gemelos" (byte-identical o deberían serlo)

| Archivo PWA | Archivo App | Estado | Acción |
|-------------|-------------|--------|--------|
| `src/lib/ocr/ine-mrz.ts` | `lib/ocr/ine-mrz.ts` | ✅ Byte-identical | Guardrail `byte-identical` |
| `src/lib/types/answer-shape.ts` | `lib/types/answer-shape.ts` | ✅ Byte-identical | Guardrail `byte-identical` |
| `src/lib/utils/jsonlogic.ts` | `lib/utils/jsonlogic.ts` | ✅ Byte-identical | Guardrail `byte-identical` |
| `src/lib/forms/validate-answer.ts` | `lib/forms/validation.ts` | ❌ 20 vs 48 reglas | Guardrail `validation` + excepción |
| `src/lib/ocr/ine-ocr-parser.ts` | `lib/ocr/ine-ocr-parser.ts` | ❌ -888 líneas | Guardrail `ocr-parser` + excepción |
| `src/lib/survey/field-types.ts` | `lib/forms/field-types.ts` | ❌ `data_list` no despachado | Guardrail `field-types` + excepción |

---

## 18. Convenciones de naming específicas PWA

| Cosa | Convención | Ejemplo |
|------|------------|---------|
| Service Worker caches | `<nombre>-cache-v<N>` | `api-cache-v5`, `pages-cache-v5` |
| Dexie DB version | Incremental (v1, v2... v7) | `DB_VERSION = 7` |
| Sync queue status | `snake_case` UPPER | `pending`, `retry_wait`, `dead_letter` |
| Field session sample type | `snake_case` | `gps`, `photo`, `gap` |
| INE side | `'front' \| 'back'` | `getIneSide(questionType)` |
| Hooks | `use<Nombre>` | `useInstallPrompt`, `useFieldSessionGate` |
| Stores (Zustand) | `<dominio>.store.ts` | `survey-fill.store.ts` |
| Services | `<dominio>.service.ts` | `static-maps-sync.service.ts` |

---

## Referencias

- `./00-overview.md` — Visión general
- `./01-domain-model.md` — Modelo de dominio detallado
- `./03-failure-modes.md` — Modos de fallo
- `./07-known-bugs.md` — Bugs con IDs trazables
- `./guardrails.md` — Detectores anti-deriva
- `brigadaApp/ai-context/particularities.md` — Particularidades móvil (si existe)