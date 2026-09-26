# brigadaPWA - Visión General

## Qué es

Progressive Web Application (PWA) para **brigadistas de campo** que realizan:
- Encuestas puerta a puerta (formularios dinámicos con motor de relevancia JSONLogic)
- Captura y OCR de credenciales INE (frente y reverso, MRZ, CIC)
- Asignación y seguimiento de consumibles (inventario, kits)
- Promociones/campañas sociales
- Mapas offline (tiles OSM + GeoJSON estáticos)
- Sincronización offline-first con cola durable, backoff exponencial, dead letters

La PWA **replica la funcionalidad de la app móvil (brigadaApp)** usando tecnologías web, con paridad objetivo en el dominio de encuestas, consumibles, promociones y admin. NO busca paridad en capacidades nativas exclusivas (Background Sync API, Push Expo, SecureStore, ubicación en background).

## Stack tecnológico

| Capa | Tecnología | Versión / Nota |
|------|------------|----------------|
| Framework | Next.js (App Router) | 16.2.10 |
| React | React | 19.2.4 |
| TypeScript | TypeScript | 5.x (strict) |
| UI | shadcn/ui + Tailwind CSS | — |
| Estado cliente | Zustand | — |
| Estado servidor | TanStack React Query | v5 |
| Base de datos local | Dexie.js (IndexedDB) | v4, esquema v7 |
| Formularios | React Hook Form + Zod | — |
| HTTP | Axios + interceptors JWT | — |
| Service Worker | Workbox (v7) | Precaching + runtime |
| Mapas | MapLibre GL JS | Tiles OSM + packs offline |
| OCR | Tesseract.js (WASM) | Modelo `spa` + diccionario mexicano |
| Build | Next.js + npm | `npm run build` / `npm run start` |
| Package manager | npm | `package-lock.json` trackeado |

## Arquitectura de directorios

```
src/
  app/                      # Next.js App Router
    (auth)/                 # Rutas públicas: login, activación
    (dashboard)/            # Rutas protegidas (requiere AuthProvider)
      surveys/              # Encuestas: listado, llenado, detalle
      sync/                 # Monitor de sincronización
      maps/                 # Mapas offline
      consumables/          # Inventario y kits (parcial)
      promotions/           # Promociones (parcial)
      help/                 # Centro de ayuda
    layout.tsx              # Root layout + providers
    api/
      backend/[...path]/    # Proxy catch-all al FastAPI backend
  components/
    ui/                     # shadcn/ui primitives
    survey/                 # Renderers de preguntas, INE, barcode
    sync/                   # SubmissionHistory, SyncStatus
    common/                 # CommandPalette, HelpMenu, EmptyState
  contexts/
    auth.context.tsx        # Auth state, login/logout, tokens
    sync.context.tsx        # Motor de sync, NetInfo, intervalos
  lib/
    api/                    # Cliente HTTP, servicios (survey, auth, tiles)
    db/                     # Dexie schema, clearDatabase, KV cache
    sync/                   # SyncEngine, retry/backoff, dead letters
    services/               # Datasets, static-maps, field-session, OCR
    hooks/                  # useInstallPrompt, useFieldSessionGate, etc.
    store/                  # Zustand stores (survey-fill, etc.)
    types/                  # Tipos compartidos (AuthState, Survey, etc.)
    utils/                  # uuid, jsonlogic, validation helpers
  workers/
    sw.js                   # Service Worker (Workbox runtime)
public/
  manifest.json             # PWA manifest
  offline.html              # Fallback offline
  icons/                    # Iconos PWA
```

## Flujo de datos principal

```
Usuario abre PWA
    ↓
AuthProvider (loadTokensFromStorage → isAuthenticated → getCurrentUser)
    ↓
SyncContext (inicia processSyncQueue, NetInfo listeners, intervalos)
    ↓
Usuario navega a /surveys → getMyAssignments() → Dexie (offline) o API (online)
    ↓
Usuario abre encuesta → fill/page.tsx
    ↓
survey-fill.store (Zustand) → answers map + fillableQuestions (filtrado por relevancia)
    ↓
Usuario finaliza → finalizeResponse({ answers, files, ... })
    ↓
SyncQueue (IndexedDB) → operation_type: CREATE_RESPONSE
    ↓
processSyncQueue (cuando online) → POST /mobile/responses → backend
    ↓
Backend valida (48 reglas, form_engine_violation, etc.)
    ↓
OK → completed → limpia cola
ERROR → retry_wait / dead_letter → retry con backoff
```

## Convenciones de código

| Regla | Detalle |
|-------|---------|
| Nombrado archivos | kebab-case (`survey-fill.store.ts`, `ine-question.tsx`) |
| Componentes | PascalCase, un componente por archivo, máx 200 líneas |
| Tipado | TypeScript strict, **no `any`**, Zod para validación de entrada |
| Manejo errores | try/catch + toast (sonner), logs estructurados en sync |
| Offline-first | Toda operación escribe en Dexie + sync_queue; nunca bloquea UI |
| Service Worker | NetworkFirst para API (excluyendo `/api/backend/`), CacheFirst para assets |
| Tokens | access → localStorage, refresh → sessionStorage + localStorage (ver nota) |
| Commits | Convencional: `fix(seed): ...`, `feat(consumables): ...`, `chore: ...` |

## Variación respecto a brigadaApp (app móvil)

| Área | brigadaApp (React Native) | brigadaPWA (Web) | Nota |
|------|---------------------------|------------------|------|
| Almacenamiento seguro | SecureStore (iOS Keychain / Android Keystore) | IndexedDB + localStorage | Techo web: XSS posible |
| Push | Expo Push Service | Web Push (VAPID) - **no implementado** | Sistemas distintos |
| Background Sync | Soportado nativamente | Background Sync API (solo Chromium) | **No perseguir paridad** |
| Ubicación background | Soportado | Restringido (batería, permisos) | **No perseguir paridad** |
| OCR | Tesseract nativo (más rápido) | Tesseract.js WASM | PWA tiene diccionario mayor |
| Mapas offline | SQLite + tiles | Dexie + Cache Storage + IndexedDB | PWA tiene tier dedicado |
| Instalación | App Store / EAS / APK | PWA install prompt (beforeinstallprompt) | Flujo web nativo |

## Riesgos conocidos de alto impacto

1. **Caché SW de API autenticada** — `/api/backend/*` cacheado 5 min, sin `Vary: Authorization`. Dos brigadistas en mismo dispositivo = exposición cruzada de PII (INE, CURP, firmas, padrones). Mitigado parcialmente con bump de versión de caché y exclusión de `/api/backend/`. Ver `03-failure-modes.md#sw-auth-cache`.
2. **Respuestas ocultas se envían** — `fill/page.tsx` manda `answers` crudo en vez de `fillableQuestions` filtrados. Backend rechaza con `form_engine_violation`. Sin poda en replay → dead letter. Ver `07-known-bugs.md#pwa-p0-1`.
3. **INE OCR nunca escribe respuesta** — `ine-question.tsx` omite `onChange`/`value`. Captura legal completa → sin dato. Ver `07-known-bugs.md#pwa-p1-1`.
4. **Validación cliente 20/48 reglas** — Faltan GIS, multimedia, `normalize_*`, `required_fields` (INE). Backend rechaza → reintentos inútiles. Ver `07-known-bugs.md#pwa-p1-2`.

## Documentación relacionada

- `./guardrails.md` — Guardrails anti-deriva PWA vs App
- `./branching-rules.md` — Reglas de enramado y flujo Git
- `./particularities.md` — Particularidades técnicas específicas
- `brigadaApp/ai-context/07-known-bugs.md` — Catálogo móvil (referencia para paridad)
- `backEnd/ai-context/01-domain-model.md` — Modelo de dominio backend