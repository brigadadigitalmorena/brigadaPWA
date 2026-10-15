# Feature Parity: brigadaPWA vs brigadaApp

> **Scope:** Comparación exhaustiva de features entre la PWA (Next.js) y la app nativa (Expo/React Native)
> **Last updated:** 2026-09-30
> **Purpose:** Referencia obligatoria para desarrolladores — cualquier feature nueva debe consult aquí antes de implementarse.

---

## Heatmap de Paridad

```
█ = FEATURE COMPLETA   ▓ = PARCIAL/DEGRADADO   ░ = NO IMPLEMENTADA   ⚠ = LIMITACIÓN DE PLATAFORMA
```

### 1. Core — Encuestas y Form Engine

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Renderizado de preguntas | █ 16 tipos | █ 16 tipos | — |
| Home + métricas diarias | █ `/home` | █ | — |
| Mapa de mis envíos | █ `/sync/map` | █ | — |
| Form Engine v2 (JSON Logic) | █ ExpressionEvaluator | █ ExpressionEvaluator | — |
| Visibility / Calculated / Default expressions | █ | █ | — |
| Constraint expressions | █ | █ | — |
| Label expressions | █ | █ | — |
| Survey fill store (Zustand) | █ | █ | — |
| Step-by-step navigation | █ | █ | — |
| Auto-save drafts | █ Dexie | █ SQLite | — |
| Resume draft (Continuar) | █ scope + Dexie fallback | █ | — |
| Entitlement model (Assignment) | █ | █ | — |
| Geo enforcement (off/warn/block) | █ | █ | — |
| Campaign scope matching | █ | █ | — |
| ZIP code autocomplete | █ lookup colonias | █ | — |

### 2. INE OCR

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Tesseract.js / ML Kit OCR | █ Tesseract | █ ML Kit | — |
| Parser multi-modelo (2008-2019) | █ 4000+ líneas | █ 800+ líneas | — |
| MRZ parser (ICAO 9303) | █ | ░ | **PWA SUPERIOR** |
| Nombre extraction (6 estrategias) | █ | █ | — |
| Domicilio extraction (6 estrategias) | █ | █ | — |
| Diccionario nombres mexicanos | █ ~400 | █ ~200 | **PWA SUPERIOR** |
| Confianza por campo | █ | █ | — |
| Correcciones OCR aprendidas | █ localStorage | █ | — |
| Compound sub-fields (editor) | █ | █ | — |
| `ocr_autofill` to other questions | █ | █ | — |
| `parseIneValue()` dual format | █ | █ | — |
| Cámara notched (guía visual) | ░ | █ | ⚠ **LIMITACIÓN WEB** — sin overlay nativo |
| Document scanner (edge detection) | ░ | █ | ⚠ **LIMITACIÓN WEB** — sin ML Kit |

### 3. Captura de Datos

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Firma (signature) | █ signature_pad | █ react-native-signature-canvas | — |
| Firma fullscreen | ░ | █ | **BAJO** |
| Firma stroke validation | ░ | █ | **BAJO** |
| Barcode scanning | ▓ BarcodeDetector | █ expo-camera | **ALTO** — solo Chrome, 3 formatos vs 15+ |
| Barcode pattern validation (regex) | ░ | █ | **MEDIO** |
| Photo capture | ▓ `<input file>` | █ expo-image-picker | **MEDIO** — sin crop UI nativo |
| Photo annotation (draw on image) | ░ | █ WebView canvas | **MEDIO** |
| Video capture | ▓ `<input video>` | █ expo-image-picker | **MEDIO** — sin duración max control |
| Audio recording | ▓ `<input audio>` | █ expo-audio | **ALTO** — sin preview, sin waveform |
| Image compression | ▓ HTML Canvas | █ expo-image-manipulator | **BAJO** — sin WEBP, browser-dependent |
| Document picker | ▓ `<input file>` | █ expo-document-picker | **BAJO** |

### 4. GPS y Ubicación

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| GPS foreground | █ navigator.geolocation | █ expo-location | — |
| GPS background (app minimized) | ░ | █ expo-task-manager | **CRÍTICO** — muere al cambiar de app |
| GPS background (screen locked) | ░ | █ foreground service Android | **CRÍTICO** |
| GPS 150s acquisition timeout | ░ configurable | █ configurable | **ALTO** |
| Location permission flow | ▓ browser prompt | █ OS permission dialogs | **BAJO** |
| Recorrido fill gate | ▓ toast | █ modal dialog + 3 modos | **BAJO** |
| WakeLock API | █ | N/A | — (PWA tiene esto) |

### 5. Offline y Sync

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Database engine | ▓ Dexie.js (IndexedDB) | █ expo-sqlite (SQLite) | **ALTO** — sin SQL, sin JOINs |
| Database encryption | ░ | █ SQLCipher | **ALTO** — datos sin cifrar |
| Schema versioning (migrations) | ▓ Dexie schema-level | █ 20 migraciones ALTER TABLE | **MEDIO** |
| Schema drift detection | ░ | █ checkSchemaDrift | **BAJO** |
| Answer integrity check | ░ | █ checkAnswersJsonIntegrity | **MEDIO** |
| Sync engine (foreground) | █ 946 líneas | █ | — |
| Background sync | ░ | █ expo-background-task cada 15min | **ALTO** — solo sync con pestaña abierta |
| Dead letter queue | █ | █ | — |
| Exponential backoff | █ | █ | — |
| Data durability (storage pressure) | ░ IndexedDB puede ser borrado | █ SQLite sobrevive | **CRÍTICO** — Safari evicta IndexedDB |
| WAL checkpoint | ░ | █ | ⚠ **LIMITACIÓN WEB** |
| Disk space probe | ░ | █ probeFreeDiskSpace | ⚠ **LIMITACIÓN WEB** |

### 6. Notificaciones

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Push notifications | ░ stub mínimo | █ expo-notifications | **ALTO** — no conectado a pipeline |
| Foreground notification display | ░ | █ | **ALTO** |
| Notification tap → deep link | ░ | █ navigate to screen | **ALTO** |
| Pantalla de notificaciones | █ lista + badge | █ lista + badge | — |
| Notificación sesión campo + action | ░ | █ "Finalizar recorrido" | **ALTO** — no posible en web |

### 7. Maps

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Map rendering | █ MapLibre GL JS | █ @maplibre/maplibre-react-native | — |
| Offline map tiles | ░ | █ tiles descargados + cache 200MB | **ALTO** |
| GIS questions (point/line/polygon) | █ web MapLibre | █ native MapLibre | — |
| Static map viewer | █ | █ | — |
| Tile download UI | ░ | █ | **MEDIO** |

### 8. Gestiones (Módulo de Seguimiento)

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Gestión list + filters | █ | █ | — |
| Gestión detail + comments | █ | █ | — |
| Gestión metrics | █ | ░ | **PWA SUPERIOR** |
| Status timeline | █ | █ | — |

### 9. UI/UX

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Haptic feedback | ░ | █ 40+ puntos | ⚠ **LIMITACIÓN WEB** |
| Dark/Light theme | █ CSS variables | █ ThemeContext | — |
| Theme settings screen | ░ | █ | **BAJO** |
| Skeleton loaders | █ | █ | — |
| Toast notifications | █ | █ | — |
| Bottom navigation | █ | █ | — |
| Sidebar (desktop) | █ | N/A | **PWA SUPERIOR** |
| User badge / member icons | █ | █ | — |
| Guided tours | ░ | ░ | — (ninguno tiene) |
| Score details screen | ░ | █ | **MEDIO** |
| Mis envíos screen | ░ | █ | **MEDIO** |
| Report issue screen | ░ | █ + expo-mail-composer | **BAJO** |
| Change avatar / edit profile | █ | █ | — |
| Debug screens (session replay) | ░ | █ | **BAJO** |

### 10. Observabilidad

| Feature | PWA | Nativa | Gap |
|---------|-----|--------|-----|
| Sentry crash reporting | ░ | █ @sentry/react-native | **CRÍTICO** |
| PostHog analytics | ░ | █ | **ALTO** |
| Structured logging | ░ console.log | █ Sentry logger | **MEDIO** |
| Reactotron (dev) | ░ | █ | **BAJO** |

---

## Heatmap Visual (Matriz de Severidad)

```
CRÍTICO ─── ALTO ─── MEDIO ─── BAJO ─── OK

                    PWA    NATIVA
                    ────   ──────
GPS Background     [░░░]   [███]    CRÍTICO
Data Durability    [░░░]   [███]    CRÍTICO
Sentry             [░░░]   [███]    CRÍTICO
Background Sync    [░░░]   [███]    ALTO
Push Notifications [░░░]   [███]    ALTO
Notif Screen       [░░░]   [███]    ALTO
DB Encryption      [░░░]   [███]    ALTO
Offline Maps       [░░░]   [███]    ALTO
Barcode Scanner    [▓▓░]   [███]    ALTO
INE Compound SF    [░░░]   [███]    ALTO
INE Flat Answer    [░░░]   [███]    ALTO
INE Extract Toggles[░░░]   [███]    ALTO
Audio Recording    [▓▓░]   [███]    ALTO
SQLite vs IndexedDB[▓▓░]   [███]    ALTO
PostHog            [░░░]   [███]    ALTO
Photo Annotation   [░░░]   [███]    MEDIO
Video Recording    [▓▓░]   [███]    MEDIO
ZIP Autocomplete   [░░░]   [███]    MEDIO
Image Compression  [▓▓░]   [███]    MEDIO
Structured Logging [░░░]   [███]    MEDIO
Score Details      [░░░]   [███]    MEDIO
Mis Envíos         [░░░]   [███]    MEDIO
Change Avatar      [░░░]   [███]    MEDIO
Recorrido Gate     [▓▓░]   [███]    BAJO
Theme Settings     [░░░]   [███]    BAJO
Signature Fullscr  [░░░]   [███]    BAJO
Report Issue       [░░░]   [███]    BAJO
Debug Screens      [░░░]   [███]    BAJO
Reactotron         [░░░]   [███]    BAJO
```

---

## Limitaciones de Plataforma (IMPOSIBLES en PWA)

Estas features **no pueden implementarse** en una PWA por restricciones del navegador:

| Feature | Razón |
|---------|-------|
| GPS en background (screen locked) | No hay API de background location en browsers |
| Haptic feedback | No hay API de vibration consistente (solo `vibrate()` básico) |
| Document scanner (edge detection) | No hay acceso a ML Kit ni cámara nativa |
| Cámara notched overlay | `<input file>` no permite custom camera UI |
| Database encryption (a nivel storage) | No se puede cifrar IndexedDB a nivel de bloque |
| Background sync programático | Service Worker sync es best-effort, no programático |
| Persistencia de datos bajo storage pressure | Safari/Chrome borran IndexedDB agresivamente |
| Notificación persistente con acciones | Web Push no soporta actions en todas las plataformas |
| File system directo | Solo acceso via `<input file>` o File System Access API (Chrome) |

---

## Features donde PWA ES SUPERIOR

| Feature | Razón |
|---------|-------|
| MRZ parser (INE reverso) | PWA tiene parser completo, nativa no |
| Diccionario nombres mexicanos | PWA ~400 nombres vs nativa ~200 |
| Sidebar (desktop) | PWA tiene sidebar colapsable, nativa es mobile-only |
| Gestiones metrics | PWA tiene dashboard de métricas, nativa no |
| OCR parser (líneas de código) | PWA 4000+ vs nativa 800+ (más estrategias) |

---

## Checklist para Features Nuevas

Cuando se implementa una feature nueva en **brigadaPWA**, verificar:

- [ ] ¿Existe en brigadaApp? Si sí, ¿qué implementación tiene?
- [ ] ¿Es una limitación de plataforma? Documentar en "Limitaciones"
- [ ] ¿Requiere GPS background? Marcar como "no implementable en PWA"
- [ ] ¿Requiere notificaciones push? Verificar soporte del browser target
- [ ] ¿Toca la DB? Considerar que IndexedDB ≠ SQLite (sin SQL, sin encriptar)
- [ ] ¿Toca compound sub-fields? Verificar `ine-batch-config.ts` y `compound-sub-fields.ts`
- [ ] ¿Toca INE OCR? Verificar flat answer format y extract toggles
- [ ] ¿Agrega un screen nuevo? Agregar al heatmap
- [ ] ¿Agrega observabilidad? Considerar Sentry/PostHog

---

## Roadmap de Paridad (Priorizado)

### Fase 1 — Crítico (blocking para producción)
- [x] INE compound sub-fields + flat answer + extract toggles
- [x] Sentry crash reporting (activo con `NEXT_PUBLIC_SENTRY_DSN`)
- [x] Notificaciones push (registro VAPID; el envío lo hace el backend)

### Fase 2 — Alto (degradación significativa)
- [x] Barcode scanner multi-format (BarcodeDetector en vivo + regex)
- [x] Background sync via Periodic Background Sync API (best-effort)
- [ ] Mapas offline tiles (Cache API + IndexedDB metadata)
- [ ] DB encryption (investigar Web Crypto API)
- [x] PostHog analytics (activo con `NEXT_PUBLIC_POSTHOG_KEY`)

### Fase 3 — Medio (mejora de UX)
- [x] Photo annotation canvas
- [x] Video recording con duración max
- [x] Audio recording in-app (MediaRecorder API)
- [x] ZIP code autocomplete (descargar índice)
- [x] Score details / Mis envíos screens (mapa + historial local; score de servidor sigue pendiente)
- [x] Change avatar / edit profile screens
- [ ] Structured logging

### Fase 4 — Bajo (polish)
- [x] Signature fullscreen + stroke validation
- [x] Report issue screen
- [x] Debug screens
- [x] Theme settings screen
