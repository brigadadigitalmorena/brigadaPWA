# Brigada PWA - Agent Guidelines

## System Overview

Progressive Web Application (PWA) for field workers (brigadistas) to complete surveys offline-first. The PWA replicates the mobile app functionality using web technologies.

For backend API documentation, see **brigadaBackEnd/AGENTS.md**.

## Build & Run

### Development

```bash
npm run dev           # Start Next.js dev server (port 3000)
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking
```

### Prerequisites

- Node.js 20+
- npm (package-lock.json trackeado; bun.lock residual)
- Backend API running (see brigadaBackEnd/)

## Tech Stack (actualizado 2026-09-26)

- **Next.js 16.2.10** (App Router) / **TypeScript 5** / **React 19.2.4**
- **shadcn/ui** + **Tailwind CSS** for UI components
- **Zustand** for client state management
- **TanStack React Query v5** for server state
- **Dexie.js v4** (IndexedDB) for offline database — schema v7
- **React Hook Form** + **Zod** for form validation
- **Axios** for HTTP client with JWT interceptors
- **Workbox v7** for Service Worker and offline caching
- **MapLibre GL JS** for maps
- **Tesseract.js (WASM)** for OCR (modelo `spa` + diccionario mexicano)
- **Path alias:** `@/*` → `./src/*`

## Architecture

```text
src/
  app/                    # Next.js App Router
    (auth)/              # Authentication routes: login, activate
    (dashboard)/         # Protected routes (requires AuthProvider)
      surveys/           # List, fill, detail
      sync/              # Sync monitor
      maps/              # Offline maps
      consumables/       # Inventory & kits (partial)
      promotions/        # Promotions (partial)
      help/              # Help center
    layout.tsx           # Root layout + providers
    api/
      backend/[...path]/ # Proxy catch-all → FastAPI backend
  components/
    ui/                  # shadcn/ui primitives
    survey/              # Question renderers, INE, barcode
    sync/                # SubmissionHistory, SyncStatus
    common/              # CommandPalette, HelpMenu, EmptyState
  contexts/
    auth.context.tsx     # Auth state, login/logout, tokens
    sync.context.tsx     # Sync engine, NetInfo, intervals
  lib/
    api/                 # HTTP client, services (survey, auth, tiles)
    db/                  # Dexie schema, clearDatabase, KV cache
    sync/                # SyncEngine, retry/backoff, dead letters
    services/            # Datasets, static-maps, field-session, OCR
    hooks/               # useInstallPrompt, useFieldSessionGate, etc.
    store/               # Zustand stores (survey-fill, etc.)
    types/               # Shared types (AuthState, Survey, etc.)
    utils/               # uuid, jsonlogic, validation helpers
  workers/
    sw.js                # Service Worker (Workbox runtime)
public/
  manifest.json          # PWA manifest
  offline.html           # Offline fallback
  icons/                 # PWA icons
```

## Critical Rules

1. **Offline-first approach.** All data operations must work offline. Sync happens when online.
2. **IndexedDB is the source of truth.** Use Dexie.js for all local data storage.
3. **JWT tokens in storage.** Access token → localStorage. Refresh token → sessionStorage (mover de localStorage, ver PWA-P1-9).
4. **Service Worker for caching.** NetworkFirst para API (excluyendo `/api/backend/`), CacheFirst para assets. Ver `workers/sw.js` y `ai-context/particularities.md`.
5. **Form validation with Zod.** All forms must validate with Zod schemas before submission.
6. **Actualiza documentación** en `ai-context/` con cada cambio. `09-change-log.md` obligatorio por PR.
7. **Ejecuta guardrails** antes de push: `npm run guardrails:check` (cuando exista). CI lo valida.

## Offline Strategy

### Database (Dexie.js v7)

```typescript
import { db } from '@/lib/db/database';

// Read data
const surveys = await db.surveys.toArray();

// Write data with sync queue
await db.transaction('rw', db.responses, db.sync_queue, async () => {
  await db.responses.add(response);
  await db.sync_queue.add({ operation: 'CREATE_RESPONSE', ... });
});
```

Entidades clave: `Survey`, `Response`, `ResponseAnswer`, `LocalFile`, `SyncQueue`, `FieldSession`, `FieldSessionSample`, `StaticMap`, `StaticMapFeature`, `KVCache`, `FileBlob`. Ver `ai-context/01-domain-model.md`.

### Sync Engine

- Queue operations in `sync_queue` table (lease-based, priority, backoff, dead-letter)
- Process queue when online (`processSyncQueue` en `sync-engine.service.ts`)
- Exponential backoff (base 30s, max 1h). Max retries: 12 uploads, 5 responses.
- Stale upload recovery via `upload_started_at` + lease duration.
- R2 error classification: `R2_RATE_LIMITED`, `R2_403_EXPIRED`.

### Service Worker

- Precache app shell (`pages-cache-v5`, `static-resources-cache-v5`, etc.)
- **NetworkFirst para API excluyendo `/api/backend/`** (tráfico autenticado no cacheado)
- CacheFirst para assets estáticos, tiles OSM (`OFFLINE_TILE_CACHE`)
- `default-cache` con `ExpirationPlugin(maxEntries: 100, maxAgeSeconds: 86400)`
- Logout purga `api-cache*` y `default-cache` (`clearDatabase()` en `database.ts`)
- Background sync event registered (`brigada-dexie-sync` tag) — wake only, procesa en cliente.

Ver `workers/sw.js`, `ai-context/particularities.md#3`, `ai-context/03-failure-modes.md#PWA-P0-3`.

## API Integration

### Authentication

```typescript
import { login, logout } from '@/lib/api/auth.service';

// Login
await login(username, password);

// Logout (guarded: bloquea si hay muestras de recorrido pendientes offline)
await logout();
```

### Offline maps

Browser calls go through `/api/backend` (see `src/app/api/backend/[...path]/route.ts`). No Next.js `rewrites`.

- `GET /api/backend/mobile/tiles/osm/manifest` proxies FastAPI `GET /mobile/tiles/osm/manifest`. Si backend 404 → sirve OSM test pack local (`osm-tile-manifest-fallback.ts`).
- Static map GeoJSON en `manifest_url` (R2) fetched server-side via `GET /api/maps-manifest?url=…` para evitar CORS.

### Survey Operations

```typescript
import { getMyAssignments, submitResponse } from '@/lib/api/survey.service';

const assignments = await getMyAssignments();  // GET /mobile/surveys (assigned only)
await submitResponse(responseData);            // POST /mobile/responses
```

## Conventions

- **File naming:** kebab-case for files, PascalCase for components
- **Component structure:** One component per file, max 200 lines
- **Type safety:** Strict TypeScript, no `any` types
- **Error handling:** Try-catch with toast notifications (sonner)
- **Loading states:** Skeleton loaders for async content
- **Commits:** Conventional (`fix(scope):`, `feat(scope):`, `chore:`, `docs:`, `refactor:`, `perf:`, `sec:`)
- **Branches:** `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>` desde `dev`. Ver `ai-context/branching-rules.md`.

## Key Documentation (ai-context/)

| Topic | File |
|-------|------|
| Índice y convenciones | `ai-context/README.md` |
| Visión general, stack, riesgos | `ai-context/00-overview.md` |
| Modelo de dominio (Dexie v7, FormEngine v2) | `ai-context/01-domain-model.md` |
| Modos de fallo (P0/P1/P2) | `ai-context/03-failure-modes.md` |
| Invariantes (I-01 a I-73) | `ai-context/04-invariants.md` |
| Casos borde | `ai-context/05-edge-cases.md` |
| Reglas de agente, workflow, testing | `ai-context/06-agent-rules.md` |
| Bugs conocidos (catálogo vivo) | `ai-context/07-known-bugs.md` |
| Change log (por PR) | `ai-context/09-change-log.md` |
| Backlog priorizado | `ai-context/10-backlog.md` |
| Reglas de enramado Git | `ai-context/branching-rules.md` |
| Guardrails anti-deriva PWA vs App | `ai-context/guardrails.md` |
| Particularidades técnicas | `ai-context/particularities.md` |
| Database schema | `src/lib/db/database.ts` |
| Auth context | `src/contexts/auth.context.tsx` |
| Sync context | `src/contexts/sync.context.tsx` |
| API client | `src/lib/api/client.ts` |
| OSM tile fallback | `src/lib/api/osm-tile-manifest-fallback.ts` |

## Workflow Requirements

- Every code change must update relevant documentation in `ai-context/`
- `09-change-log.md` entry obligatoria por PR mergeado
- Run `npm run type-check` before committing
- Run `npm run lint` before committing
- Run `npm run guardrails:check` before push (script a crear; CI lo ejecuta)
- Test offline functionality before deploying

## Testing (objetivo)

```bash
# Unit tests (Vitest) - PENDIENTE configurar
npm test

# E2E tests (Playwright) - PENDIENTE configurar
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint

# Guardrails anti-deriva (script a crear)
npm run guardrails:check
```

> **Estado actual**: `npm test` y `npm run test:e2e` documentados pero **no implementados**. Solo `test:sync` y `test:campaigns` existen como scripts custom. Ver `07-known-bugs.md#PWA-P2-5` y `10-backlog.md#P2-1`.

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

### Docker (multi-stage, producción)

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
CMD ["node", "server.js"]
```

> **Nota**: `next.config.ts` debe tener `output: 'standalone'`. Dockerfile actual corre `npm run dev` — no usar en producción.

## Security

- HTTPS required for Service Workers
- JWT tokens with expiration (verificar expiración en `isAuthenticated()`, ver PWA-P1-9)
- **Content Security Policy headers: CONFIGURAR en `next.config.ts`** (actualmente ausente)
- Input validation with Zod
- XSS protection (React default)
- **Permissions-Policy y HSTS: CONFIGURAR** (pendiente)
- Refresh token → sessionStorage only (mover de localStorage, ver PWA-P1-9)
- Floor 24h local session (implementar, ver `MOB-SESSION-24H-FLOOR-2026-05-14`)

## Performance

- Code splitting with Next.js (automático por ruta)
- Image optimization with `next/image` + `sizes` + `priority` above-fold
- Lazy loading para componentes pesados (`dynamic(() => import(...))`)
- Service Worker caching (ver estrategias arriba)
- IndexedDB para datos offline
- Bundle target: < 200KB gzipped initial

## Accessibility

- Semantic HTML (`<button>`, no `<div onClick>`)
- `label` asociado a cada input (`htmlFor` / `id`)
- Contraste WCAG 2.1 AA (Tailwind auditado)
- Navegación teclado: focus visible, skip links, trap en modales
- ARIA solo cuando HTML nativo no basta
- **axe-core en CI: PENDIENTE** (ver `10-backlog.md#P2-12`)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+ (limitaciones: Background Sync API no soportado, SW no sobrevive cierre)
- Edge 90+

## PWA Installation

1. Visit the site in a supported browser
2. Click "Install" or "Add to Home Screen" (usa `beforeinstallprompt` + `install-prompt.tsx`)
3. App appears as native application

## Offline Capabilities

- View cached surveys (Dexie + SW precache)
- Fill surveys offline (Zustand store + Dexie persistence)
- Save responses locally (Dexie + sync_queue)
- Sync when online (NetInfo + processSyncQueue + exponential backoff)
- View sync status (SubmissionHistory component)
- Offline maps: tiles OSM + GeoJSON vectorial (Cache Storage + IndexedDB)

## Paridad con brigadaApp (móvil) — Alcance declarado

| ✅ Paridad objetivo | ❌ Fuera de alcance (no perseguir) |
|---------------------|-----------------------------------|
| Consumibles (catálogo, kits, analítica) | Background Sync API (POSTs offline) |
| Promociones (cache, action modal, sync) | Push notifications nativo (Expo) |
| Perfil / settings / ayuda | SecureStore para tokens |
| Validación completa (48 reglas + normalize) | Ubicación background (GPS continuo) |
| OCR INE endurecido (18 funciones + MRZ/CIC) | Biometría / FaceID / TouchID |
| Admin (mi-equipo, status, analytics) | APK / IPA build |
| Barcode scanner robusto | |
| Sync robusto (singleton, cross-tab, error classifier) | |

Ver `ai-context/00-overview.md#variación-respecto-a-brigadaapp`, `ai-context/guardrails.md`, `ai-context/particularities.md#16`.

## Future Enhancements (tracking en `10-backlog.md`)

- [ ] Push notifications (Web Push VAPID)
- [ ] Background sync improvements (solo Chromium)
- [ ] Conflict resolution UI
- [x] Signature capture
- [ ] Advanced offline maps (vector tiles styling)
- [ ] Multi-language support (i18n)
- [ ] INE OCR server-side validation
- [ ] Image compression before upload
- [ ] CSP + HSTS + Permissions-Policy headers
- [ ] Test suite real (Vitest + Playwright + CI)
- [ ] Guardrails anti-deriva en CI
- [ ] Paquete compartido (monorepo o git submodule) para código idéntico

---

## Incident Response (ver `03-failure-modes.md`)

| Severidad | Acción inmediata |
|-----------|------------------|
| **P0** (datos, PII, bloqueo total) | Hotfix en `main` → tag patch → deploy mismo día. Post-mortem 48h. |
| **P1** (funcionalidad core rota) | Fix en `dev` → PR → merge ≤ 2 días. |
| **P2** (deuda, UX) | Sprint planning. |

**Contacto on-call**: Ver `docs/on-call.md` (crear si no existe).