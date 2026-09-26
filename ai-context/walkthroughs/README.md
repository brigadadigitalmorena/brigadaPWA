# Walkthroughs - brigadaPWA

Guías paso a paso para flujos clave. Cada walkthrough es autocontenido y actualizado con cada cambio en el flujo.

## Índice

| Walkthrough | Archivo | Última actualización |
|-------------|---------|---------------------|
| Login y activación de cuenta | `01-login-activation.md` | 2026-09-26 |
| Llenado de encuesta offline | `02-survey-fill-offline.md` | 2026-09-26 |
| Captura y OCR de INE | `03-ine-capture-ocr.md` | 2026-09-26 |
| Sincronización y cola de sync | `04-sync-queue.md` | 2026-09-26 |
| Descarga y uso de mapas offline | `05-offline-maps.md` | 2026-09-26 |
| Gestión de consumibles (parcial) | `06-consumables.md` | 2026-09-26 |
| Promociones y canje (parcial) | `07-promotions.md` | 2026-09-26 |
| Sesiones de recorrido (field sessions) | `08-field-sessions.md` | 2026-09-26 |
| Logout seguro con guardia | `09-logout-guarded.md` | 2026-09-26 |
| Instalación PWA y actualizaciones | `10-pwa-install-updates.md` | 2026-09-26 |

## Convenciones

- **Formato**: Markdown con pasos numerados, capturas de pantalla referenciadas (`![Paso 1](../public/docs/screenshots/walkthrough-XX-01.png)`), y cajas de "Qué esperar" / "Solución de problemas".
- **Actualización**: Cada PR que modifique el flujo debe actualizar el walkthrough correspondiente y `09-change-log.md`.
- **Versión**: Incluir `appVersion` al final del archivo para trazabilidad.

## Plantilla base

```markdown
# [Nombre del flujo]

**Versión app**: `vX.Y.Z` | **Fecha**: YYYY-MM-DD | **Autor**: @usuario

## Objetivo
Qué logra el usuario al completar este flujo.

## Precondiciones
- Qué debe tener/configurar el usuario antes de empezar.

## Pasos

### 1. [Acción]
[Descripción + captura]

**Qué esperar**: [Resultado visual/estado]

### 2. [Acción]
...

## Solución de problemas comunes

| Síntoma | Causa | Acción |
|---------|-------|--------|
| ... | ... | ... |

## Referencias técnicas
- Código: `src/app/...`, `src/lib/services/...`
- Docs: `../05-edge-cases.md#...`, `../03-failure-modes.md#...`
```

## Estado actual

| Walkthrough | Estado | Prioridad |
|-------------|--------|-----------|
| 01-login-activation | 🔴 Pendiente | P0 (onboarding) |
| 02-survey-fill-offline | 🔴 Pendiente | P0 (core) |
| 03-ine-capture-ocr | 🔴 Pendiente | P0 (core + bug PWA-P0-4) |
| 04-sync-queue | 🟡 Esqueleto | P1 |
| 05-offline-maps | 🔴 Pendiente | P1 |
| 06-consumables | 🔴 Pendiente | P1 (feature parcial) |
| 07-promotions | 🔴 Pendiente | P1 (feature parcial) |
| 08-field-sessions | 🔴 Pendiente | P1 |
| 09-logout-guarded | 🟡 Esqueleto | P0 (patrón crítico) |
| 10-pwa-install-updates | 🔴 Pendiente | P1 |

> **Próximo**: Crear `01-login-activation.md` y `09-logout-guarded.md` (flujos críticos con guardias de seguridad).