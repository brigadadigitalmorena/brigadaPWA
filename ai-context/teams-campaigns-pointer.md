# Teams / campañas (puntero)

Rama: `feat/teams-campaigns-entitlements`.

El listado y el fill van por campaña (`campaignId` + `entitlementId` en la URL). El cache de sesión también se indexa por campaña para no mezclar dos operativos de la misma plantilla. Wipe de `assignments_all_offline` al persistir el snapshot nuevo.

Fuente de verdad: `brigadaBackEnd/ai-context/teams-campaigns/00-README.md`

No mergear a `main` hasta QA conjunto.
