# Prioritarias y Gestión (PWA)

## Prioritarias (resalte en `/surveys`)

Ya no hay pantalla `/extras`. Las encuestas **temporales** (`survey_type = extra`) o con **fecha de cierre** (`ends_at`) se listan en **Encuestas** y se resaltan (barra, tinte y badge por urgencia).

- Excluye gestión, completadas y revocadas
- Pendientes prioritarias se pinnean al tope de la lista (el toolbar de Orden sigue aplicando dentro de cada grupo)
- `/extras` redirige a `/surveys` (bookmarks / SW viejo)
- Para iniciar encuestas de gestión → **Encuestas** (`/surveys`)

## Gestión (`/tracking`)

Solo **seguimiento de solicitudes ya enviadas** (`GET /mobile/gestiones/tracking`).

- Folio, estatus, comentarios, historial
- **No** lista encuestas disponibles para llenar
- Empty state: completar una encuesta de gestión desde Encuestas primero

## Encuestas (`/surveys`)

Lista `GET /mobile/surveys` (asignaciones del usuario autenticado).

El backend actual emite `assignment_id` / `group_*`; la PWA los mapea a `entitlement_id` / `campaign_*` antes de pintar.

Si el login funciona pero la pantalla queda vacía, no hay filas en `assignments` para ese usuario — el seed local debe crearlas.
