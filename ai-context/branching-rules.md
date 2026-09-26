# Reglas de Enramado - brigadaPWA

## Ramas principales

| Rama | Propósito | Protección | Longevidad |
|------|-----------|------------|------------|
| `dev` | Integración continua. Base para todo trabajo. | **Protegida**: PR obligatorio, 1 review min, CI passing, no force-push | Permanente |
| `main` | Solo tags de release (`vX.Y.Z`). Deploy automático. | **Protegida**: solo merge desde `dev` via release PR, tag obligatorio | Permanente |

## Ramas de trabajo

### Convención de nombres

```
<tipo>/<slug-corto>

tipos:
  feat/   — nueva funcionalidad user-facing
  fix/    — corrección de bug (referencia ID en 07-known-bugs.md)
  chore/  — mantenimiento (deps, config, CI, docs, refactor sin cambio funcional)
  docs/   — solo documentación
  perf/   — optimización de rendimiento
  sec/    — seguridad (rotación credenciales, headers, etc.)
```

Ejemplos:
- `feat/consumables-kits`
- `fix/ine-ocr-onchange` (ref: PWA-P0-4)
- `chore/update-deps-sep2026`
- `docs/update-known-bugs`
- `sec/csp-headers`

### Reglas de vida

| Regla | Detalle |
|-------|---------|
| **Base siempre `dev`** | `git checkout dev && git pull && git checkout -b fix/mi-fix` |
| **Vida máxima 2 semanas** | Si supera, rebase sobre `dev` semanalmente (`git fetch origin && git rebase origin/dev`) |
| **Commits atómicos** | Un commit = un cambio lógico. Mensaje convencional. |
| **No commits directos a `dev`** | Siempre PR. |
| **PR → review → merge** | Mínimo 1 approval. CI debe pasar (type-check, lint, guardrails cuando existan). Merge strategy: **squash** (historial limpio en `dev`). |
| **Rama merged → se conserva en remoto** | Traceability. `git push origin --delete` **no** salvo acuerdo explícito. Local: `git branch -d <rama>` tras merge (pregunta al owner antes). |
| **No `force-push` en ramas compartidas** | `push --force-with-lease` solo en tu fork/branch personal sin colaboradores. |

## Flujo de Release

```
dev (continuous integration)
   │
   │  (cuando hay features listas para release)
   ▼
Release PR: `chore/release-vX.Y.Z` desde `dev` → `main`
   │
   │  - Actualiza `package.json` version
   │  - Genera changelog desde `09-change-log.md`
   │  - CI completo + smoke test en staging
   ▼
Merge a `main` (squash) → tag `vX.Y.Z` → deploy automático
   │
   ▼
`dev` continúa (next minor)
```

### Versionado (SemVer)

| Componente | Cuándo incrementar |
|------------|-------------------|
| **MAJOR** (X.0.0) | Cambios breaking en API pública, schema DB, contratos sync |
| **MINOR** (0.Y.0) | Features nuevas compatibles, APIs nuevas, páginas nuevas |
| **PATCH** (0.0.Z) | Fixes de bugs, docs, chores, refactors sin cambio funcional |

`dev` siempre apunta al próximo **MINOR**. `main` = último **PATCH** del último MINOR.

## Hotfix en producción

```
main (v1.2.3)
   │
   │  git checkout -b fix/prod-critical-bug main
   ▼
Fix mínimo → test en staging → PR a `main`
   │
   ▼
Merge a `main` → tag `v1.2.4` → deploy
   │
   ▼
Cherry-pick o merge `main` → `dev` (para que no se pierda)
```

## Git hooks (configurar en `.husky/`)

| Hook | Comando |
|------|---------|
| `pre-commit` | `npm run lint --if-staged` (lint-staged) |
| `pre-push` | `npm run type-check && npm run guardrails:check` |
| `commit-msg` | Validar conventional commits (`commitlint`) |

## Comandos útiles

```bash
# Nueva feature
git checkout dev && git pull && git checkout -b feat/mi-feature

# Nuevo fix (referencia bug ID)
git checkout dev && git pull && git checkout -b fix/PWA-P0-4-ine-ocr-onchange

# Rebase semanal
git fetch origin && git rebase origin/dev

# Push con lease (seguro)
git push --force-with-lease origin fix/mi-fix

# Limpiar ramas merged locales
git branch --merged dev | grep -v "^\*\|dev" | xargs -r git branch -d

# Ver ramas remotas merged (conservar)
git branch -r --merged origin/dev
```

## Referencias

- `./06-agent-rules.md` — Reglas obligatorias por PR
- `./guardrails.md` — Checks anti-deriva en CI
- `brigadaApp/ai-context/branching-rules.md` — Convención hermana (alineada)
- `backEnd/ai-context/branching-rules.md` — Convención backend (alineada)