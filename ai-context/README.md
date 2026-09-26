# brigadaPWA - Documentación Técnica

Este directorio contiene la documentación técnica viva del proyecto **brigadaPWA** (Progressive Web App para brigadistas de campo).

## Índice

| Archivo | Propósito | Última actualización |
|---------|-----------|---------------------|
| `00-overview.md` | Visión general, arquitectura, stack, convenciones | 2026-09-26 |
| `01-domain-model.md` | Modelo de dominio: entidades, relaciones, esquemas | 2026-09-26 |
| `03-failure-modes.md` | Modos de fallo conocidos y estrategias de mitigación | 2026-09-26 |
| `04-invariants.md` | Invariantes del sistema que nunca deben romperse | 2026-09-26 |
| `05-edge-cases.md` | Casos borde y su manejo | 2026-09-26 |
| `06-agent-rules.md` | Reglas para agentes (incluye guardrails y branching) | 2026-09-26 |
| `07-known-bugs.md` | Catálogo de bugs conocidos (seeded desde auditoría) | 2026-09-26 |
| `09-change-log.md` | Registro de cambios (una entrada por PR mergeado) | 2026-09-26 |
| `10-backlog.md` | Backlog priorizado (P0/P1/P2) | 2026-09-26 |
| `branching-rules.md` | Reglas de enramado y flujo de trabajo Git | 2026-09-26 |
| `guardrails.md` | Guardrails anti-deriva (PWA vs App móvil) | 2026-09-26 |
| `particularities.md` | Particularidades técnicas específicas de la PWA | 2026-09-26 |
| `walkthroughs/` | Guías paso a paso para flujos clave | 2026-09-26 |

## Convenciones

- **Nomenclatura**: `NN-nombre-descriptivo.md` con numeración correlativa
- **Archivos obsoletos**: mover a `_stale/` con sufijo `STALE-YYYY-MM-DD`
- **Actualización obligatoria**: cada PR debe actualizar `09-change-log.md` y cualquier doc afectado
- **Cross-referencia**: usar rutas relativas (`./07-known-bugs.md#pwa-p0-1`)

## Estado actual

- **Rama principal**: `dev`
- **Último deploy**: `origin/dev@c367a2f` (2026-09-07)
- **Producción**: Sí, con datos reales de hogares (PII)
- **Paridad objetivo**: Consumibles, Promociones, Perfil, Validación completa, OCR, Admin. NO: Background Sync, Push nativo, SecureStore, Background location.