# Backlog - brigadaPWA

> Prioridad: **P0** (esta semana) → **P1** (2-4 sprints) → **P2** (trimestre). Estimación en días-hombre (1 DH = 1 dev × 1 día).

---

## P0 - Esta semana (contención producción)

| ID | Título | Estimación | Dependencias | Estado |
|----|--------|------------|--------------|--------|
| P0-1 | **Payload submit = solo `fillableQuestions`** + poda en replay `form_engine_violation` | 3 DH | `fill/page.tsx`, `sync-engine.service.ts` | 🔴 Por hacer |
| P0-2 | **Implementar "Corregir respuesta" O cambiar copy** | 2 DH | `submission-history.tsx`, `error-copy.ts`, routing a fill | 🔴 Por hacer |
| P0-3 | **Confirmar deploy SW v5 en prod + auditoría exposición** | 1 DH | Deploy Vercel/Docker, verificación DevTools | 🟡 En curso (code done) |
| P0-4 | **INE `onChange` + captura ambos lados + validación `required_fields`** | 3 DH | `ine-question.tsx`, `validate-answer.ts`, `build-flat-ine-answer.ts`, `response-submission.service.ts` | 🟢 Hecho (PR #5) |
| P0-5 | **CMS: leer `?doc=` en help page** (51 permalinks) | 1 DH | `webCMS/src/app/dashboard/help/page.tsx` | 🔴 Por hacer |
| P0-6 | **CMS: borrar instrucciones ficticias Auditoría/Revertir + corregir Analytics/Dashboard** | 2 DH | `webCMS/src/data/docs-manual.ts` | 🔴 Por hacer |

---

## P1 - Próximos 2-4 sprints (paridad funcional)

### Consumibles (completar)
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-C1 | Consumibles: catálogo completo (CRUD offline) | 8 DH | Repository, pages, sync queue `CREATE_CONSUMABLE` |
| P1-C2 | Consumibles: kits (asignación + tracking) | 5 DH | `consumable-kits` schema, UI |
| P1-C3 | Consumibles: analítica (dashboard + export) | 5 DH | Gráficos, filtros, CSV/XLSX |

### Promociones (completar)
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-P1 | Promociones: cache offline + lista/detalle | 5 DH | Dexie table, sync queue, UI |
| P1-P2 | Promociones: action modal (canjear, ver detalle) | 4 DH | Modal + validación stock |
| P1-P3 | Promociones: sync offline (queue + replay) | 3 DH | `CREATE_PROMOTION_REDEMPTION` |

### Validación y FormEngine (paridad completa)
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-V1 | Portar 28 reglas faltantes (GIS, multimedia, tiempo, tipos) | 6 DH | Módulo compartido o replicar `validate-answer.ts`. INE `required_fields` ya está hecho (P0-4), reste de 28. |
| P1-V2 | `normalizeAnswerByRules` (7 reglas `normalize_*`) | 3 DH | Pre-procesamiento antes de submit |
| P1-V3 | ~~`required_fields` INE~~ | — | 🟢 Hecho en PR #5 (P0-4). Contract cascade + labels + tests en `tests/ine/` |
| P1-V7 | Recortar `required_fields` INE en el seed del backend | 1 DH | `backEnd/scripts/seed_v2_full.py:412` configura 13 campos; la política acordada es 4. Es config del CMS, no bug de cliente. |
| P1-V4 | `data_list` renderer (`DataListQuestion`) | 3 DH | Autocompletar SEPOMEX (ver P1-C4) |
| P1-V5 | `read_only` / `calculated` honrados en renderers | 2 DH | `field-types.ts` + `question-renderer.tsx` |
| P1-V6 | `requires_active_session` default `warn` | 1 DH | `use-field-session-gate.ts` |

### OCR (endurecimiento)
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-O1 | Portar 18 funciones OCR (`4fb63e4`) | 8 DH | Parser + tests regresión |
| P1-O2 | Guardrail CI: diff parser PWA vs App | 2 DH | Script + GitHub Action |

### Perfil y Admin
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-A1 | Perfil: editar nombre, avatar, password, soporte | 5 DH | Form + API + validación |
| P1-A2 | Admin: `mi-equipo` (lista brigadistas, roles) | 4 DH | RBAC client-side |
| P1-A3 | Admin: `mis-envios` reconcile (respuestas vs asignaciones) | 3 DH | |
| P1-A4 | Admin: analytics dashboard (paridad App) | 6 DH | Gráficos, export, filtros |
| P1-A5 | Admin: status por usuario / por equipo | 3 DH | |
| P1-A6 | Notificaciones: implementar (push web VAPID) | 8 DH | Service Worker push, backend endpoint |

### Sync y Offline
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-S1 | `syncOrchestrator` singleton (desacoplar de React) | 5 DH | `MOB-SYNC-UI-LIFECYCLE` fix |
| P1-S2 | Cross-tab single-flight uploads (BroadcastChannel) | 3 DH | `MOB-ONLINE-MEDIA-DUPLICATE` fix |
| P1-S3 | Clasificador errores upload (`classifyUploadError`) | 2 DH | `MOB-R2-403-ALL-EXPIRED` fix |
| P1-S4 | Storage cap 200MB + cleanup 6h + rutas protegidas | 3 DH | `MOB-CACHE-200MB` fix |
| P1-S5 | Barcode scanner loop robusto + secure-context check | 3 DH | `requestVideoFrameCallback` |

### Código de barras / ZIP
| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P1-C4 | ZIP autocomplete: índice SEPOMEX + `ZipAutocompleteField` | 5 DH | `lib/zip-cache.ts` port |

---

## P2 - Este trimestre (calidad, higiene, antideriva)

| ID | Título | Estimación | Notas |
|----|--------|------------|-------|
| P2-1 | `npm test` + `npm run test:e2e` real (Vitest + Playwright) | 10 DH | Unit, integration, E2E happy path |
| P2-2 | CI GitHub Actions (type-check, lint, guardrails, tests) | 5 DH | `.github/workflows/` |
| P2-3 | CSP + HSTS + Permissions-Policy headers | 3 DH | `next.config.ts` |
| P2-4 | Refresh token → sessionStorage only + floor 24h | 2 DH | `auth.service.ts`, `client.ts` |
| P2-5 | Link checker + `ai-context` freshness validator en CI | 2 DH | Scripts + Action |
| P2-6 | Extraer paquete compartido: `ine-mrz`, `answer-shape`, `jsonlogic`, `validation` | 8 DH | Monorepo npm workspace o git submodule |
| P2-7 | `07-known-bugs.md` sync bidireccional con App (script) | 2 DH | |
| P2-8 | Multi-language support (i18n) | 8 DH | next-intl o similar |
| P2-9 | Observabilidad: Sentry + PostHog | 3 DH | DSN en env |
| P2-10 | Rewrite `README.md` / `PROJECT_STATUS.md` (actualizar stack real) | 2 DH | |
| P2-11 | Dockerfile multi-stage + `npm run start` | 2 DH | |
| P2-12 | Accesibilidad: axe-core en CI + auditoría manual | 3 DH | |

---

## Fuera de alcance (documentado, no perseguir)

| ID | Título | Razón |
|----|--------|-------|
| OOS-1 | Background Sync API (POSTs offline) | Solo Chromium, iOS no soporta. SW no sobrevive cierre en Safari. |
| OOS-2 | Push notifications nativo (Expo) | Web Push = VAPID, sistema distinto. No paridad. |
| OOS-3 | SecureStore para tokens | IndexedDB/localStorage es techo web. XSS risk persists. |
| OOS-4 | Ubicación background (GPS continuo) | Batería + permisos + restricciones web. |
| OOS-5 | Biometría / FaceID / TouchID | WebAuthn posible pero distinto flujo. No core. |
| OOS-6 | APK / IPA build | PWA es web. EAS/Capacitor = otro producto. |

---

## Métricas de seguimiento

| Métrica | Target | Actual (2026-09-26) |
|---------|--------|---------------------|
| Bugs P0 abiertos | 0 | 4 |
| Bugs P1 abiertos | ≤ 5 | 9 |
| Cobertura tests | ≥ 70% | 0% (no test runner) |
| Drift detector (guardrails) | ✅ passing | ❌ no implementado |
| Docs `ai-context` freshness | ≤ 7 días | 0 días (recién creadas) |
| Bundle inicial gzipped | < 200KB | ~280KB (estimado) |
| CSP score | A+ | F (ausente) |