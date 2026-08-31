# Teams / campañas (puntero)

Rama: `feat/teams-campaigns-entitlements`.

El listado y el fill van por campaña (`campaignId` + `entitlementId` en la URL). El cache de sesión también se indexa por campaña para no mezclar dos operativos de la misma plantilla. Wipe de `assignments_all_offline` al persistir el snapshot nuevo.

El backend en `dev` todavía responde `assignment_id` / `group_*`. `src/lib/campaigns/normalize.ts` adapta esas filas al contrato de entitlements.

Fuente de verdad: `brigadaBackEnd/ai-context/teams-campaigns/00-README.md`

No mergear a `main` hasta QA conjunto.
