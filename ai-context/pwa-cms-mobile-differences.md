# Brigada: PWA vs CMS vs App móvil

> **Para quién:** desarrolladores que van a seguir el PWA (`brigadaPWA`) y necesitan saber qué existe en cada cliente, qué contrato comparte el backend, y qué **no** se debe copiar a ciegas.
> **Última actualización:** 2026-09-30
> **Repos hermanos (mismo directorio padre):** `brigadaPWA`, `brigadaFrontEnd`, `brigadaWebCMS`, `brigadaBackEnd`

Este documento **no sustituye** el heatmap de paridad PWA↔móvil (`feature-parity-heatmap.md`). Ese archivo es la checklist de features de campo. Este es el mapa de **sistemas**: roles, stacks, APIs, offline, dependencias y trampas de portabilidad.

---

## 1. Qué es cada pieza

```text
                    diseña / asigna / audita
   ┌──────────────────────────────────────────────┐
   │  brigadaWebCMS  (admin, Next.js, online)     │
   │  /admin/*  +  cookies HttpOnly               │
   └────────────────────┬─────────────────────────┘
                        │
                        ▼
              brigadaBackEnd (FastAPI + Postgres)
              fuente de verdad: RBAC, schemas,
              ingestión batch, R2, geo, gestiones
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
  brigadaFrontEnd              brigadaPWA
  (Expo / SQLite)              (Next.js / Dexie)
  /mobile/*  JWT               /mobile/*  JWT
  offline nativo               offline navegador
```

| Cliente | Repo | Usuario | Trabajo principal | Offline |
|---------|------|---------|-------------------|---------|
| **CMS** | `brigadaWebCMS` | Admin, encargado, auditor. **Nunca brigadista.** | Diseñar encuestas, usuarios, asignaciones, áreas, analytics, revisión de respuestas | No. Online-only. |
| **App móvil** | `brigadaFrontEnd` | Brigadista (y flujos de encargado si existen en layouts). | Captura en campo, sync durable, OCR nativo, GPS background | Sí. SQLite + cola. Es el contrato original de campo. |
| **PWA** | `brigadaPWA` | Brigadista en navegador / “Add to Home Screen”. | El **mismo trabajo de campo** que la app, con APIs web | Sí, con límites de navegador (IndexedDB, SW). |
| **API** | `brigadaBackEnd` | Todos | Seguridad, validación, persistencia | N/A |

**Regla de oro:** el CMS **escribe** el producto (schema, campañas, permisos). Móvil y PWA **consumen** `/mobile/*` y **nunca** deben llamar `/admin/*`. El backend valida todo; la validación en CMS/PWA/móvil es UX.

Versiones de paquete (orientativas, no semver cruzado):

| Repo | `package.json` version | Runtime real |
|------|------------------------|--------------|
| CMS | 3.0.0 | Next **14.2**, React **18.3** |
| Móvil | 3.0.0 | Expo **~54**, RN **0.81.5**, React **19.1** |
| PWA | 0.1.0 | Next **16.2**, React **19.2** |

El PWA es el cliente más nuevo y el que más se parece a móvil en **producto**, no en **plataforma**.

---

## 2. Stack y dependencias

### 2.1 Comparativa de capas

| Capa | PWA | Móvil | CMS |
|------|-----|-------|-----|
| UI | Next App Router, shadcn/ui, Tailwind 4, Sonner | Expo Router, componentes RN, lucide-react-native | Next App Router, shadcn/ui, Tailwind **3.4**, Sonner |
| Estado servidor | TanStack Query 5 | Contextos + repos SQLite | TanStack Query 5 |
| Estado fill | Zustand 5 (`survey-fill.store`) | Zustand / hooks `useFillSurvey` | Zustand 4 (auth, sidebar, builder) |
| Formularios | RHF + Zod 4 | RHF + Zod 5 | RHF + Zod **3.25** |
| HTTP | Axios → `/api/backend` (proxy Next) | Axios directo al API | Axios → `/api/backend` (proxy + cookie) |
| DB local | Dexie 4 (IndexedDB) schema v7 | expo-sqlite 16, `APP_DB_VERSION` (p. ej. 9) + SQLCipher opcional | Ninguna |
| Lógica de preguntas | `json-logic-js` 2.0.5 + Form Engine v2 | `json-logic-js` 2.0.5 + Form Engine v2 | `json-logic-js` 2.0.5 (builder + preview) |
| Mapas | MapLibre GL JS 5 | `@maplibre/maplibre-react-native` 10 | Mapbox GL 3.4 **y** MapLibre 5.23 |
| OCR INE | Tesseract.js 7 (WASM en el hilo del browser) | `@react-native-ml-kit/text-recognition` + document scanner | No captura; configura extraer campos en el builder |
| Firma | `signature_pad` | `react-native-signature-canvas` | Preview en builder, no captura de campo |
| Media | `<input type="file">`, Canvas compress | expo-image-picker, expo-audio, expo-camera | Upload R2 desde admin (S3 SDK) |
| Sync background | Workbox (best-effort, pestaña viva) | `expo-background-task` ~15 min | N/A |
| Observabilidad | `console` / toasts | Sentry + PostHog + Reactotron | Vercel Analytics + PostHog (opcional) |
| Push | Stub Web Push (`web-push.service.ts`) | `expo-notifications` + `/mobile/push-token` | Centro de notificaciones admin |

### 2.2 Dependencias que **deben** permanecer alineadas

Estas librerías interpretan el **mismo JSON** que publica el CMS. Si una versión diverge en operadores o tipos, las encuestas se llenan distinto en PWA vs móvil.

| Contrato | Dónde vive | Quién lo consume |
|----------|------------|------------------|
| `json-logic-js` **2.0.5** | Los tres clientes | Visibility, calculated, constraint, label |
| Matrices `ai-context/contracts/jsonlogic-operator-matrix.v2.json` | BackEnd, CMS, FrontEnd (copias) | Qué operadores están permitidos en el builder |
| `validation_rules.v2.json` | Mismas copias | Claves que el renderer debe leer |
| Tipos de pregunta backend | `BACKEND_QUESTION_TYPES` en PWA `src/lib/survey/question-type-registry.ts` | CMS builder + móvil renderers + PWA renderers |
| `client_id` UNIQUE / status `duplicate` = éxito | Backend ingestión | Cola de sync PWA y móvil |
| Entitlements (`entitlement_id`, `campaign_id`) | Backend `GET /mobile/surveys` | PWA `normalize.ts` + móvil assignments |

**No hay paquete npm compartido.** Cada repo copia Form Engine / parsers. Un fix en móvil **no** llega al PWA hasta que se porte a mano. Al implementar lógica de encuesta, abrir el archivo equivalente en `brigadaFrontEnd` y el setting en el CMS.

### 2.3 Dependencias que **no** se copian

| Móvil / CMS | Por qué el PWA no las usa |
|-------------|---------------------------|
| `expo-*`, ML Kit, SQLCipher, SecureStore | APIs nativas |
| `@aws-sdk/client-s3` en el CMS | El brigadista sube via presign `/mobile/documents/*`, no contra R2 directo |
| `@dnd-kit`, React Flow, Recharts, `xlsx`, `shpjs` | Builder, shapefiles, reportes: trabajo de CMS |
| Mapbox token | PWA usa MapLibre + tiles OSM / packs offline |
| Cookie `access_token` del CMS | El PWA guarda JWT en **localStorage** (mismo modelo que móvil, no el del CMS) |

---

## 3. Auth, roles y sesión

### 3.1 Tres modelos de sesión distintos

| | PWA | Móvil | CMS |
|--|-----|-------|-----|
| Login | `POST /mobile/login` JSON | `POST /mobile/login` JSON | `POST /api/auth/login` (proxy) → cookie |
| Access token | `localStorage` `brigada_access_token` | AsyncStorage `@brigada:access_token` | Cookie **HttpOnly** `access_token` (JS no la ve) |
| Refresh | `localStorage` + `sessionStorage` `brigada_refresh_token` → `POST /mobile/token/refresh` | **expo-secure-store** `brigada_refresh_token` | Cookie / `/api/auth/refresh` |
| Perfil | `localStorage` `brigada_user` | AsyncStorage | Zustand + localStorage (perfil, no el JWT) |
| Proxy | Browser siempre pega a `/api/backend/*` (evita CORS) | URL absoluta `EXPO_PUBLIC_API_URL` | `/api/backend/*` inyecta cookie → `Authorization` |
| Timeout Axios | 30 s | similar | 60 s default |
| Idempotency-Key | No en PWA (batch usa `client_id`) | En sync | Auto en POST/PUT/PATCH del CMS |

**Implicación:** no reutilizar el `client.ts` del CMS en el PWA. El PWA debe seguir el cliente **móvil** (Bearer JWT, `/mobile/*`).

### 3.2 Quién puede entrar dónde

| Rol / permiso | CMS | Móvil | PWA |
|---------------|-----|-------|-----|
| Brigadista (`submit_response`, `view_surveys`) | Middleware **bloquea** (`user_cms_access` exige admin/encargado/auditor) | Sí | Sí |
| Encargado / admin | Sí (`access_cms`, `manage_*`) | Limitado (no es el cliente de diseño) | No hay UI de diseño; si hacen login móvil verán solo lo que `/mobile/surveys` les asigne |
| Permisos | `hasPermission("key")` — nunca `user.role === "admin"` | Igual, `Permission.*` | PWA todavía usa más `role_key` en UI; al añadir gates, copiar el estilo de **claves** del CMS/móvil |

Activación de cuenta:

| Flujo | PWA | Móvil | CMS |
|-------|-----|-------|-----|
| Activar / crear password | `/activate` | `(auth)/activation`, `create-password` | `/activate`, `/verify-email` |
| Forgot password | No | Parcial | `/forgot-password`, `/reset-password` |

---

## 4. Superficie de API

Prefijos del backend (`brigadaBackEnd/app/api/`):

| Prefijo | Quién llama | Ejemplos |
|---------|-------------|----------|
| `/mobile/*` | PWA + móvil | surveys, responses/batch, documents, notifications, gestiones, maps, zip-lookup, field-sessions, me, score |
| `/auth/*` | CMS (y a veces overlap) | login cookie, refresh CMS |
| `/admin/*` | **Solo CMS** | surveys builder, users, areas, analytics, cron, tiles admin |
| `/public/*` | Activación sin sesión | codes |

### 4.1 Endpoints de campo que el PWA ya usa

Definidos sobre todo en `src/lib/api/*.ts`:

- Auth: `/mobile/login`, `/mobile/token/refresh`, `/mobile/me`, perfil/avatar/password
- Encuestas: `/mobile/surveys`, latest version, `/mobile/responses/batch`, presign documents
- Sync: `/mobile/sync-status`, freshness/delta según motor
- Gestiones: `/mobile/gestiones/tracking`, comments
- Mapas: `/mobile/maps`, tiles OSM manifest (proxy Next dedicado)
- Notificaciones in-app: `/mobile/notifications*`
- ZIP: `/mobile/zip-lookup/{code}`
- Recorridos: `/mobile/field-sessions*`

### 4.2 Endpoints de campo que el PWA **aún no** consume (móvil sí o backend ya existe)

Priorizar contra el heatmap, no implementar “porque existe”:

| Endpoint | Uso en móvil | PWA |
|----------|--------------|-----|
| `GET /mobile/score/latest` | `score-details.tsx` | No hay pantalla de score |
| `GET /mobile/daily-metrics` | Home / métricas | No |
| `POST /mobile/push-token` | Expo push | Stub Web Push; VAPID y payload distintos a Expo |
| `GET /mobile/responses/me` | Historial servidor | Envíos son cola local `/sync` |
| `POST /mobile/sync/validate`, reconcile, restore | Recuperación de dispositivo | Parcial / no |
| Issue reporting | `report-issue.tsx` + mail | No |

### 4.3 Lo que el CMS llama y el PWA no debe llamar

Cualquier `admin_*.py`: builder, publish, unpublish, assignment-groups, users, roles, areas shapefile, reports CSV, cron, whitelist, activation-codes, sync-monitor. Si un coordinador necesita eso, usa el CMS.

---

## 5. Offline, sync y almacenamiento

### 5.1 Contrato de sync (PWA y móvil, no CMS)

Máquina de estados de la cola (ambos clientes):

```text
pending → leased → completed
                ↘ retry_wait → (backoff) → leased
                ↘ failed_permanent / dead_letter / discarded
```

Invariantes del backend (romperlas es pérdida de datos):

1. **`duplicate` = éxito.** El servidor ya tiene ese `client_id`. Marcar synced, no reintentar como error.
2. Un item del batch no debe abortar los demás (SAVEPOINT en API).
3. La cola tiene que sobrevivir un crash: SQLite en móvil; Dexie en PWA.

### 5.2 Tablas locales

**PWA** (`src/lib/db/database.ts`, Dexie v7, nombre `BrigadaPWA`):

`surveys`, `responses`, `response_answers`, `local_files`, `file_blobs`, `sync_queue`, `kv_cache`, `field_sessions`, `field_session_samples`, `static_maps`, `static_map_features`.

**Móvil** (SQLite): además `events` (append-only), `datasets` (catálogos), cifrado SQLCipher en builds de campo, probe de disco, WAL.

**CMS:** cero persistencia de respuestas de campo.

### 5.3 Diferencias que rompen features al portar

| Tema | Móvil | PWA | Qué hacer en PWA |
|------|-------|-----|------------------|
| Tipo de `survey_id` en índices | SQL absuelve | IndexedDB **es estricto** (`"5"` ≠ `5`) | Siempre `String(survey_id)` en Dexie `.equals()` |
| Query params `campaignId` | Tipado | `Number(null) === 0` | `parseOptionalScopeId` en `src/lib/campaigns/scope.ts` |
| Soft navigation Next | N/A | RSC + SW = fallo offline | `window.location.assign` en fill (ver `navigateToSurveyFill`) |
| Safari evicts IndexedDB | SQLite sobrevive | Datos de campo se pueden borrar | No prometer durabilidad tipo nativo; documentar a ops |
| GPS con pantalla bloqueada | Foreground service | Imposible | Recorridos PWA solo con pestaña visible + WakeLock |
| Background sync 15 min | `expo-background-task` | Solo con SW / pestaña | Usuario debe abrir la PWA para drenar cola |

Service Worker PWA (`workers/sw.js`): precache de shell (`/surveys`, `/drafts`, `/sync`, …), NetworkFirst para RSC (`next-rsc-cache`, timeout 3 s), fill shell `/surveys/__fill_shell__`. El CMS **no** es PWA.

---

## 6. Encuestas: quién diseña, quién llena

```text
CMS builder  →  publica versión  →  Postgres
                                      │
                    GET /mobile/surveys  (entitlements + latest_version)
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                   App móvil                    PWA
              renderers nativos            QuestionRenderer
              SQLite draft                 Dexie draft
              POST /mobile/responses/batch (mismo payload)
```

### 6.1 Form Engine v2

Los tres clientes usan JSONLogic. El PWA adapta `SurveyVersion` → schema en `src/lib/forms/survey-to-form-schema.ts` y `useSurveyFormEngine`.

Al cambiar visibilidad/constraints:

1. Ver operadores permitidos en `jsonlogic-operator-matrix.v2.json` (CMS/BackEnd).
2. Portar evaluación a PWA `ExpressionEvaluator` / `json-logic.ts`.
3. No inventar operadores que el builder no serializa.

### 6.2 Tipos de pregunta

El CMS es el **catálogo**: si un tipo no está en el builder, móvil/PWA no lo van a recibir. Si el CMS guarda una `validation_rules` key y el renderer lee otra, la regla **nunca aplica** (auditoría CMS `question-types-audit-2026-05-04.md`: `max_duration_seconds` vs `max_duration_s`, `interval_seconds` vs `interval_s`, etc.).

Al añadir soporte en PWA:

1. Alias en `question-type-registry.ts`.
2. Renderer en `src/components/survey/QuestionTypes/`.
3. `validate-answer.ts` + shape de respuesta (`ine-answer.ts`, `zip-answer.ts`).
4. Misma clave de `validation_rules` que lee **móvil**, no un nombre “más claro”.
5. Payload de sync idéntico al de `brigadaFrontEnd` (el backend no tiene adaptador PWA).

Renderers PWA (kind): text, textarea, number, date, choice, choice_multi, choice_image, range, media, signature, location, gis, ine, barcode, readonly, compound_zip.

Móvil tiene componentes extra más maduros: `voice-question`, `video-question`, `photo-annotation-canvas`, `gis-tracking-question`, validación de strokes en firma, Barcode nativo 15+ formatos.

### 6.3 INE y ZIP (ya alineados en PWA con móvil a nivel de contrato)

| Contrato | Archivo PWA | Notas |
|----------|-------------|-------|
| Respuesta compuesta INE `{ front, back, ocrData }` | `src/lib/forms/ine-answer.ts` | `ocr_autofill` a otras preguntas |
| ZIP `{ codigo_postal, colonia, … }` | `src/lib/forms/zip-answer.ts` | Lookup `/mobile/zip-lookup/{code}` |
| Parser OCR | `src/lib/ocr/*` (más completo que móvil en MRZ / diccionario) | Captura: `<input>` vs ML Kit + scanner |

El CMS solo configura extraer/autofill; no corre Tesseract.

---

## 7. Mapas de pantallas (producto)

### 7.1 PWA — `src/app`

| Ruta | Equivalente móvil | Equivalente CMS |
|------|-------------------|-----------------|
| `/login`, `/activate` | `(auth)/login-enhanced`, activation | `/login`, `/activate` (otro auth) |
| `/surveys`, `/surveys/[id]/fill` | `questionnaires`, `surveys/fill` | Preview builder (read-only) |
| `/drafts` | `drafts` (oculto en tabs) | — |
| `/extras` | `extras` | — (prioridad se configura en asignaciones) |
| `/tracking` | `tracking` (Gestión) | `/dashboard/gestiones` (operación completa) |
| `/maps` | `maps`, `static-map-viewer` | `/dashboard/maps`, `/dashboard/areas-v2` |
| `/recorridos` | GIS tracking **por pregunta**; no hay módulo Recorridos 1:1 | Config `field_tracking` en encuesta/campaña |
| `/sync` | `mis-envios` | `/dashboard/sync-monitor` (ops, no el brigadista) |
| `/notifications` | archivo existe, **tab `href: null`** (“not available yet”) | `/dashboard/notifications` (admin) |
| `/profile`, `/profile/password` | `profile`, `edit-profile`, `change-password`, `change-avatar` | `/dashboard/settings` (admin) |
| — | `score-details`, `report-issue`, `theme-settings`, `networks`, `help`, `debug/*` | analytics, users, roles, cron, whitelist, builder, … |

Nav PWA: `src/components/common/nav-items.ts` (módulos gated por `app-config.service.ts`). Offline desactiva tracking/notifications según `offlineEnabledModules`.

### 7.2 CMS — `src/app/dashboard` (no portar al PWA)

Surveys + builder + preview + JSONLogic graph, assignment-groups, users, roles, areas-v2 (shapefiles), gestiones config, analytics, reports, sync-monitor, whitelist, activation-codes, maps admin, notifications admin, cron, my-access, help.

### 7.3 Móvil — tabs brigadista

Inicio, Seguimiento, Cuestionarios, Envíos. El resto (mapas, drafts, fill, profile, extras) está oculto del tab bar y se abre por navegación.

---

## 8. Matriz de funcionalidades (tres columnas)

Leyenda: **█** completo · **▓** parcial · **░** no · **—** no aplica · **⚠** límite de plataforma

### Campo (captura)

| Capacidad | PWA | Móvil | CMS |
|-----------|-----|-------|-----|
| Llenar encuesta asignada | █ | █ | — (solo preview) |
| Borradores + Continuar | █ (scope + Dexie; ver `surveyResumeHref`) | █ | — |
| Form Engine v2 | █ | █ | █ builder |
| INE compound + OCR autofill | █ Tesseract | █ ML Kit | Configura campos |
| ZIP colonias | █ | █ | Índice SEPOMEX (`build:zip-index`) |
| Firma | █ | █ + fullscreen/strokes | — |
| Foto / video / audio | ▓ file input | █ nativo | — |
| Barcode | ▓ BarcodeDetector Chrome | █ expo-camera | Config |
| GIS line/polygon/tracking | ▓ web MapLibre | █ nativo + tracking | Config intervalos (ojo keys) |
| Geo enforcement warn/block | █ | █ | Define áreas |
| Recorridos (field sessions) | █ módulo + gate | ▓ tracking GIS, no misma UX | Define `field_tracking` |
| GPS background | ░ ⚠ | █ | — |
| Corregir respuesta (dead letter) | █ `/sync` | █ | Puede ver fallos en sync-monitor |

### Operación / admin

| Capacidad | PWA | Móvil | CMS |
|-----------|-----|-------|-----|
| Diseñar encuesta | ░ | ░ | █ builder + versiones inmutables publicadas |
| Publicar / despublicar | ░ | ░ | █ (confirmar impacto en móvil) |
| Usuarios, roles, whitelist | ░ | ░ | █ |
| Asignar campañas / grupos | ░ | ░ | █ assignment-groups |
| Analytics / export CSV | ░ | ▓ score local | █ |
| Áreas geo / shapefile | ░ | consume resolve | █ areas-v2 |
| Sync monitor global | ░ (solo cola propia) | ░ | █ |
| Cron / health | ░ | ░ | █ / system |

### Cuenta y sistema

| Capacidad | PWA | Móvil | CMS |
|-----------|-----|-------|-----|
| Perfil / avatar / password | █ | █ | █ settings admin |
| Inbox notificaciones | █ | ▓ pantalla existe, tab deshabilitado | █ admin |
| Push OS | ░ stub Web Push | █ Expo | Envía desde admin |
| Theme | █ CSS | █ + `theme-settings` | █ next-themes |
| Sentry / PostHog | ░ | █ | ▓ |
| Instalar como app | █ manifest + SW | Store / sideload | No |

---

## 9. Observabilidad y calidad

| | PWA | Móvil | CMS |
|--|-----|-------|-----|
| Crash reporting | No | Sentry RN | Sentry backend + opcional front |
| Analytics producto | No | PostHog | PostHog / Vercel |
| Tests | `bun test` / `node --test` en `tests/` (campaigns, ine, zip, sync utils) | `test:sync` puntual; E2E en otro repo | scripts builder / intent-roundtrip |
| Docs internas | `AGENTS.md`, este archivo, heatmap | `ai-context/00–10` | `ai-context/00–13` |
| Change log formal | Parcial | `09-change-log.md` obligatorio | igual |

Al portar un fix de sync desde móvil, leer **también** `brigadaFrontEnd/ai-context/04-invariants.md` y `02-sync-behavior.md`.

---

## 10. Entorno local

Desde `brigadaBackEnd` (Docker): CMS **:3000**, PWA **:3001**, API **:8000**, Postgres host **:15432**, Redis **:16379**. Scripts: `./scripts/start-local.sh`.

PWA nativo: `npm run dev` (puerto 3000 si no hay Docker). Browser → `/api/backend` → `API_URL`.

Variables PWA (`.env.example`): `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_API_TIMEOUT`, `NEXT_PUBLIC_ENABLE_SW_DEV` (dejar `false` en dev salvo pruebas offline).

CMS necesita Mapbox/MapTiler para áreas. Móvil necesita `EXPO_PUBLIC_API_URL` y a menudo `google-services.json` para FCM.

---

## 11. Trampas al “seguir mejorando el PWA”

Copiar UI del CMS (tablas admin, builder) al PWA **es un error de producto**: el brigadista no publica encuestas.

Copiar una pantalla móvil sin el **payload de sync** es un error de datos: el backend no distingue PWA vs app.

Checklist al implementar algo nuevo en PWA:

1. **¿Es trabajo de campo o de oficina?** Oficina → CMS. Campo → PWA + mismo contrato que móvil.
2. **¿Existe ya en `brigadaFrontEnd`?** Abrir el screen + API + repositorio SQLite. Portar comportamiento, no componentes RN.
3. **¿El CMS guarda una key de `validation_rules`?** Usar **esa** key (ver auditoría de tipos).
4. **¿Toca IndexedDB?** `String()` en índices; no `Number(searchParams.get(...))` sin `parseOptionalScopeId`.
5. **¿Navega a `/fill`?** Online: Link. Offline: `navigateToSurveyFill` / `location.assign`. Incluir `campaignId` + `entitlementId` + `resumeDraftId`.
6. **¿Es GPS / cámara / push / cifrado / haptic?** Marcar ⚠ o degradar; no fingir paridad.
7. **¿Cambia el schema de encuesta?** Coordinar CMS + backend; PWA y móvil despliegan renderers **después** de publicar.
8. **¿Cambia ingestión?** `duplicate` = success; batch; presign R2 igual que móvil.
9. Actualizar **este archivo** y `feature-parity-heatmap.md` en el mismo ciclo.
10. Type-check + tests de campaigns/forms. Probar Continuar borrador online **y** offline.

### Deuda conocida (PWA vs móvil, sep 2026)

Prioridad de campo (el heatmap visual aún puede listar ítems ya hechos; confiar en las tablas actualizadas y en el código):

- Hecho recientemente: INE compound, ZIP, corregir respuesta, perfil/avatar/password, inbox notificaciones, resume de borradores con scope.
- Sigue crítico / alto: Sentry, GPS background (⚠), durabilidad IndexedDB (⚠), push real, mapas offline al nivel 200 MB nativo, barcode multi-formato, background sync, cifrado, score/mis métricas, report-issue.
- Recorridos PWA existen; GPS de ruta se cae al background: no venderlos como el tracking nativo.

---

## 12. Archivos ancla por tema

| Tema | PWA | Móvil | CMS | Backend |
|------|-----|-------|-----|---------|
| Guidelines | `AGENTS.md` | `AGENTS.md` | `AGENTS.md` | `AGENTS.md` |
| Auth client | `src/lib/api/client.ts` | `lib/api/client.ts` | `src/lib/api/client.ts` + `middleware.ts` | `app/api/auth.py`, `mobile.py` |
| Fill | `src/app/(dashboard)/surveys/[id]/fill/page.tsx` | `app/(brigadista)/surveys/fill.tsx` | builder + preview | survey versions |
| Scope campañas | `src/lib/campaigns/scope.ts` | assignments API | assignment-groups | `assignments.py` |
| Sync | `src/lib/services/sync-engine.service.ts` | `lib/services/offline-sync.ts` | sync-monitor | `02-sync-ingestion.md` |
| DB local | `src/lib/db/database.ts` | `lib/db/database.ts` | — | Postgres/Alembic |
| Tipos pregunta | `question-type-registry.ts` | `components/survey/*` | `BuilderSettings.tsx` | schemas SurveyVersion |
| Paridad campo | `ai-context/feature-parity-heatmap.md` | `ai-context/00-overview.md` | `question-types-audit-*.md` | contracts/ |

---

## 13. Resumen en una frase

El **CMS** define y opera el sistema; la **app móvil** es la implementación de referencia de captura offline; el **PWA** es el mismo producto de brigadista sobre web, hablando `/mobile/*` como la app, con Dexie/SW en lugar de SQLite/Expo, y con un techo duro en GPS background, notificaciones OS, cámara nativa y durabilidad del storage.
