# Casos Borde - brigadaPWA

## Autenticación y sesión

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **Token expirado mid-request** | Interceptor detecta 401 → `refreshToken()` → reintenta request original (máx 1 vez) | `client.ts:interceptors.response.use` |
| **Refresh token expirado / inválido** | `logout()` forzado → redirige a `/login` con `?session=expired` | `auth.service.ts:refreshToken()` |
| **Dos pestañas, una hace logout** | Otra pestaña detecta `storage` event → `clearDatabase()` + reload | `auth.context.tsx` (pendiente listener) |
| **Login con credenciales inválidas** | Toast error + mantiene formulario + no limpia tokens previos | `auth.context.tsx:login()` |
| **Activación de cuenta (primer login)** | Flujo `/activate/:code` → valida código → setea password → login automático | `src/app/(auth)/activate/[code]/page.tsx` |
| **Código de activación expirado (72h)** | Backend 400 → UI muestra "Código expirado, solicita uno nuevo" | `whitelist/page.tsx:231` (72h) |

## Offline y sincronización

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **Usuario abre app offline** | Carga shell desde SW precache → datos desde Dexie → UI funcional | `sw.js` precache + `navigationHandler` |
| **Finaliza encuesta offline** | Guarda en Dexie (`status: completed`, `sync_status: pending`) → encola `CREATE_RESPONSE` | `fill/page.tsx` + `sync-engine.service.ts` |
| **Vuelve online** | `NetInfo` detecta → `processSyncQueue()` → procesa por prioridad | `sync.context.tsx:NetInfo.addEventListener` |
| **Backend responde 409 (conflicto versión)** | Re-fetch survey → merge local changes → reintenta | `sync-engine.service.ts` (pendiente) |
| **Backend responde `form_engine_violation`** | **Poda respuestas de preguntas no visibles** → reintenta automático (máx 1 vez) | `sync-engine.service.ts` (PENDIENTE - ver PWA-P0-HIDDEN-ANSWERS) |
| **Archivo grande (>10MB) en conexión lenta** | Chunked upload? No implementado. Hoy: upload único con timeout 5 min. | `file-upload.service.ts` |
| **Presigned URL expira mid-upload** | `R2_403_EXPIRED` → re-solicita presigned → reintenta desde byte 0 | `sync-engine.service.ts:518-523` (parcial) |
| **Dos pestañas suben mismo archivo** | **Race condition** → duplicados en backend (PWA-P1-CROSS-TAB-UPLOAD) | PENDIENTE fix con BroadcastChannel |
| **Cola sync crece indefinidamente** | `max_retries` agotado → `dead_letter` → UI muestra "Requiere atención" | `sync-engine.service.ts`, `submission-history.tsx` |
| **Logout con sync en progreso** | Espera `processSyncQueue()` actual → `clearDatabase()` → logout | `auth.context.tsx:81-134` |

## Encuestas y FormEngine

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **Pregunta con `relevance_expression` compleja** | JSONLogic evalúa contra `answers` actual → muestra/oculta en <50ms | `survey-fill.store.ts:filter(q => isRelevant(...))` |
| **Campo calculado (`calculated_expression`)** | Re-evaluado en cada `setAnswer` → `evaluated_label` actualizado | `survey-fill.store.ts` (parcial) |
| **Usuario navega atrás/adelante en fill** | `answers` persiste en store → no pierde datos | `survey-fill.store.ts` (Zustand persist) |
| **Pregunta `data_list` (autocompletar)** | **Actualmente cae en renderer no soportado** (PWA-P1-READONLY-CALCULATED) | PENDIENTE despachar `DataListQuestion` |
| **Pregunta `read_only` del backend** | Renderiza como solo lectura (label + valor, sin input) | `field-types.ts` reconoce, pero renderer no respeta |
| **Sección con `jump_expression`** | Salta a sección objetivo si expresión true | `fill/page.tsx:goToSection` |
| **Encuesta con 100+ preguntas** | Virtualización de lista + lazy render | `fill/page.tsx` (pendiente) |
| **Validación cruzada (Q2 depende de Q1)** | `relevance_expression` de Q2 usa `q1` → evalúa dinámico | JSONLogic nativo |

## OCR e INE

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **INE frente: CURP no detectado** | Reintenta con preprocesamiento (contraste, binarización) → si falla, permite entrada manual | `ine-ocr.service.ts` + `ine-ocr-parser.ts` |
| **INE reverso: Clave Elector espaciada** | Parser normaliza (`compactAlphanumeric`) → valida regex `CLAVE_ELECTOR_SPACED_RE` | `ine-ocr-parser.ts` (App tiene, PWA faltante) |
| **Ambos lados capturados, OCR parcial** | Combina campos: frente da CURP+nombre, reverso da domicilio+vigencia → `buildFlatIneAnswer` | `ine-question.tsx` (PENDIENTE onChange) |
| **Usuario corrige campo OCR manualmente** | Guarda corrección en `localStorage` (`ine-ocr-corrections:{curp}`) → reaplica en próximas capturas | `ocr-corrections.ts` |
| **Cámara sin permiso / no disponible** | Fallback a input type=file → usuario sube foto desde galería | `ine-question.tsx:handleFileChange` |
| **Dispositivo sin WASM / Tesseract falla** | Toast error + permite entrada 100% manual | `recognizeIne()` try/catch |

## Mapas offline

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **Descarga pack tiles (500MB+) en 3G** | Progreso visible → resume si interrumpe → valida checksum | `static-maps-sync.service.ts` (streaming) |
| **Tile no en cache offline** | Muestra placeholder gris + "Sin conexión" → no rompe mapa | MapLibre `error` event handler |
| **Manifiesto tiles actualizado (nueva versión)** | `manifest_etag` cambia → re-descarga solo tiles modificados | `offline-tiles.service.ts:compareManifests` |
| **Storage lleno mid-descarga** | `navigator.storage.estimate()` → alerta → pausa → usuario libera espacio | `offline-tiles.service.ts:96-113` (mide, no aplica tope) |

## Dispositivo y navegador

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **Safari iOS (no SW background sync)** | Funciona online. Offline: solo lectura de caché. Sin background sync POST. | Documentado en `particularities.md` |
| **Chrome Android (Background Sync API)** | Registra `sync` event → `processSyncQueue()` al restaurar conectividad | `sw.js:263-275` (solo wake, no procesa) |
| **PWA instalada, usuario borra datos del sitio** | `clearDatabase()` + `caches.delete()` → próximo login re-sync completo | `service-worker.ts:clearServiceWorkerCaches()` |
| **Rotación de pantalla en fill** | Layout responsive → no pierde scroll ni estado | Tailwind + `fill/page.tsx` |
| **Teclado virtual oculta input activo** | `scrollIntoView({ behavior: 'smooth', block: 'center' })` | `fill/page.tsx:scrollToFirstError` |

## Datos y migraciones

| Caso | Comportamiento esperado | Implementación |
|------|------------------------|----------------|
| **Migración Dexie v6→v7** | `upgrade` renombra `assignment_json` → `entitlement_json` | `database.ts:v7.upgrade` |
| **Usuario actualiza app (SW nuevo)** | `skipWaiting` → `clients.claim()` → reload automático (toast) | `sw.js:314-318`, `service-worker.ts:applyWaitingServiceWorker` |
| **Esquema survey cambia (backend v3)** | `engine_version` en Survey → `fill/page.tsx` ramifica renderer | `survey-fill.store.ts` (pendiente) |
| **Caché SW corrupto** | `unregisterServiceWorker({clearCaches:true})` + reload | `service-worker.ts:unregisterServiceWorker` |

---

## Referencias

- `./03-failure-modes.md` — Modos de fallo catastróficos
- `./07-known-bugs.md` — Bugs conocidos con IDs trazables
- `./guardrails.md` — Detectores automáticos
- `brigadaApp/ai-context/05-edge-cases.md` — Casos borde móvil (para paridad)