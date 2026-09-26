# Reglas para Agentes - brigadaPWA

## Reglas obligatorias (cada PR)

1. **Actualiza documentación afectada**. Si cambias código, actualiza:
   - `09-change-log.md` (entrada obligatoria)
   - Cualquier doc en `ai-context/` que describa lo modificado
   - `10-backlog.md` si completas/creas tarea

2. **Type-check y lint antes de commit**
   ```bash
   npm run type-check
   npm run lint
   ```

3. **Tests para nueva lógica**. Mínimo: unit test para helpers, integration para flujos críticos (sync, OCR, fill).

4. **Convencional commits**: `fix(scope): ...`, `feat(scope): ...`, `chore: ...`, `docs: ...`, `refactor: ...`

5. **Branch naming**: `fix/<slug>`, `feat/<slug>`, `chore/<slug>`, `docs/<slug>`. Base: `dev`.

6. **PR template**: Usa `.github/pull_request_template.md` (crear si no existe).

7. **No commits directos a `dev`**. Siempre PR → review → merge (fast-forward o squash).

8. **Guardaillas anti-deriva** (ver `./guardrails.md`):
   - Ejecuta `npm run guardrails:check` antes de push (script a crear)
   - CI falla si OCR parser, validadores o field-types divergen de la App

## Flujo de trabajo Git

```
dev (protected)
  ↑
  │  PR → review → merge (squash)
  │
feat/consumables-assignments   ← rama de feature
fix/ine-ocr-onchange           ← rama de fix
chore/update-deps              ← mantenimiento
docs/update-known-bugs         ← docs
```

**Reglas de rama**:
- `dev` es la única rama larga. `main` solo para tags de release.
- Ramas de feature/fix: vida ≤ 2 semanas. Si se alarga, rebase sobre `dev` semanalmente.
- Ramas merged → **se conservan en remoto** (traceability). Local: `git branch -d` tras merge (pregunta antes).
- **No `force-push`** en ramas compartidas. `push --force-with-lease` solo en tu fork/branch personal.

## Versionado y releases

- SemVer en `package.json` (`major.minor.patch`)
- `dev` = próximo minor. `main` = último release taggeado.
- Release: tag `vX.Y.Z` en `main` → deploy automático (Vercel/Docker).
- Changelog generado desde `09-change-log.md` entries.

## Seguridad

- **NUNCA** commitear secretos, tokens, credenciales. `.env*` en `.gitignore`.
- Rotar credenciales si se filtran (ver `03-failure-modes.md#credencial-dev`).
- CSP headers en `next.config.ts` (configurar).
- `Permissions-Policy` y `HSTS` en headers (pendiente).

## Accesibilidad

- Semántica HTML nativa (`<button>`, no `<div onClick>`).
- `label` asociado a cada input (`htmlFor` / `id`).
- Contraste WCAG 2.1 AA (Tailwind auditado).
- Navegación teclado: focus visible, skip links, trap en modales.
- ARIA solo cuando HTML nativo no basta.

## Rendimiento

- Code-splitting por ruta (Next.js automático).
- Imágenes: `next/image` + `sizes` + `priority` en above-fold.
- Lazy load componentes pesados (`dynamic(() => import(...))`).
- Bundle analyzer: `npm run build && npx @next/bundle-analyzer`.

## Testing (objetivo)

| Nivel | Herramienta | Cobertura objetivo |
|-------|-------------|-------------------|
| Unit | Vitest | Helpers, stores, validators, jsonlogic |
| Integration | Vitest + MSW | Sync engine, auth flow, fill flow |
| E2E | Playwright | Login → fill → sync → logout (happy path) |
| Visual | Playwright + Percy | Componentes UI críticos |

> **Estado actual**: Solo `test:sync` y `test:campaigns` configurados. `npm test` **no existe**. Ver `07-known-bugs.md#PWA-P2-TESTS-MISSING`.

## Internacionalización

- Español (México) como locale base.
- Strings en código → claves de traducción (pendiente i18n lib).
- Fechas: `Intl.DateTimeFormat('es-MX')`. Números: `Intl.NumberFormat('es-MX')`.

## Observabilidad (pendiente)

- Sentry para errores (DSN en env).
- PostHog / Mixpanel para eventos (configurar).
- Logs estructurados: `console.log(JSON.stringify({ level, msg, ctx }))`.

---

## Checklist de PR (copia en descripción)

- [ ] `npm run type-check` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run guardrails:check` pasa (cuando exista)
- [ ] Tests unit/integration añadidos/actualizados
- [ ] `09-change-log.md` actualizado
- [ ] Docs afectadas actualizadas (`ai-context/*.md`)
- [ ] No `console.log`/`debugger` en código productivo
- [ ] No `any` types nuevos
- [ ] Commits convencionales
- [ ] Branch name correcto
- [ ] PR description explica **qué** y **por qué** (contexto para reviewer)