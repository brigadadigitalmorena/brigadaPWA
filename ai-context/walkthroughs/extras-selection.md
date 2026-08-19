# Pantallas Prioritarias y Gestión (PWA)

## Prioritarias (`/extras`)

Encuestas **temporales** (`survey_type = extra`) o con **fecha de cierre** (`ends_at`).

- Excluye gestión y encuestas normales abiertas
- Para iniciar encuestas de gestión → **Encuestas** (`/surveys`)

## Gestión (`/tracking`)

Solo **seguimiento de solicitudes ya enviadas** (`GET /mobile/gestiones/tracking`).

- Folio, estatus, comentarios, historial
- **No** lista encuestas disponibles para llenar
- Empty state: completar una encuesta de gestión desde Encuestas primero

## Encuestas (`/surveys`)

Todas las entitlements activas, incluidas gestión (badge "Gestión").
