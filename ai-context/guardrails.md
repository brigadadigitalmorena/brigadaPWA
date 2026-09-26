# Guardrails Anti-Deriva - brigadaPWA vs brigadaApp

> **Propósito**: Detectar automáticamente cuando la PWA se desincroniza de correcciones críticas ya aplicadas en la app móvil (brigadaApp). La deriva silenciosa es cómo la PWA perdió 18 funciones OCR, 28 reglas de validación, y el fix de hidden answers.

## Principio

> **"La App es la fuente de verdad para fixes de dominio compartido. La PWA debe replicarlos o documentar divergencia intencional."**

## Archivos bajo guardia (paridad obligatoria)

| Área | Archivo PWA | Archivo App | Check |
|------|-------------|-------------|-------|
| **OCR Parser** | `src/lib/ocr/ine-ocr-parser.ts` | `brigadaApp/lib/ocr/ine-ocr-parser.ts` | Funciones públicas + constantes regex |
| **Validación FormEngine** | `src/lib/forms/validate-answer.ts` | `brigadaApp/lib/forms/validation.ts` | Reglas públicas + `normalizeAnswerByRules` |
| **Field Types** | `src/lib/survey/field-types.ts` | `brigadaApp/lib/forms/field-types.ts` | Mapas de tipos + propiedades |
| **MRZ / INE-CIC** | `src/lib/ocr/ine-mrz.ts` | `brigadaApp/lib/ocr/ine-mrz.ts` | **Byte-identical** (ya lo son) |
| **Answer Shape** | `src/lib/types/answer-shape.ts` | `brigadaApp/lib/types/answer-shape.ts` | **Byte-identical** |
| **JSONLogic** | `src/lib/utils/jsonlogic.ts` | `brigadaApp/lib/utils/jsonlogic.ts` | **Byte-identical** |
| **Sync Queue Schema** | `src/lib/db/database.ts` (SyncQueue) | `brigadaApp/lib/db/database.ts` | Estatus, lease, priority, retry |
| **Field Session** | `src/lib/db/database.ts` (FieldSession) | `brigadaApp/lib/db/database.ts` | Wire format idéntico |

## Detectores implementados (scripts)

### 1. `scripts/guardrails/ocr-parser-diff.ts`
Compara exports públicos de `ine-ocr-parser.ts` en ambos repos. Falla si:
- Función pública en App no existe en PWA
- Firma distinta (parámetros/retorno)
- Constante regex ausente

```bash
npm run guardrails:ocr-parser
```

### 2. `scripts/guardrails/validation-rules-diff.ts`
Compara `rules` object y `normalizeAnswerByRules` exportados. Falla si:
- Regla en App no implementada en PWA
- `normalizeAnswerByRules` ausente en PWA

```bash
npm run guardrails:validation
```

### 3. `scripts/guardrails/field-types-diff.ts`
Compara `fieldTypeRegistry`, `isReadOnlyType`, `isCalculatedType`, `getRendererComponent`. Falla si divergen.

```bash
npm run guardrails:field-types
```

### 4. `scripts/guardrails/byte-identical-check.ts`
Verifica que archivos **declarados byte-identical** lo sigan siendo:
- `ine-mrz.ts`
- `answer-shape.ts`
- `jsonlogic.ts`
- `validation.ts` (base shared)

```bash
npm run guardrails:byte-identical
```

### 5. `scripts/guardrails/known-bugs-sync.ts`
Compara `07-known-bugs.md` PWA vs App. Falla si:
- Bug P0/P1 en App resuelto (> 30 días) sin entrada correspondiente en PWA
- Entrada en PWA sin referencia a App bug ID

```bash
npm run guardrails:known-bugs
```

## Comando maestro

```bash
npm run guardrails:check
# Ejecuta todos los anteriores. Exit code 0 = OK, 1 = falla con reporte.
```

## Integración CI (`.github/workflows/guardrails.yml`)

```yaml
name: Guardrails Anti-Deriva
on:
  pull_request:
    branches: [dev]
  schedule:
    - cron: '0 6 * * 1'  # Semanal lunes 6am
  workflow_dispatch:

jobs:
  guardrails:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Necesario para diff vs App
      - name: Clone brigadaApp for comparison
        run: git clone --depth=1 https://github.com/brigadadigitalmorena/brigadaApp ../brigadaApp
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - name: Run guardrails
        run: npm run guardrails:check
        env:
          APP_REPO_PATH: ../brigadaApp
```

## Excepciones documentadas (divergencia intencional)

| Archivo | Divergencia | Justificación | Expira | Dueño |
|---------|-------------|---------------|--------|-------|
| `validate-answer.ts` | 20/48 reglas | Gap conocido, plan P1-V1 | 2026-12-31 | Equipo PWA |
| `ine-ocr-parser.ts` | -888 líneas | Gap conocido, plan P1-O1 | 2026-12-31 | Equipo PWA |
| `field-types.ts` | `data_list` no despachado | Gap conocido, P1-V4 | 2026-11-30 | Equipo PWA |
| `sync-engine.service.ts` | Sin `syncOrchestrator` singleton | Gap conocido, P1-S1 | 2026-11-30 | Equipo PWA |

> **Regla**: Toda excepción debe tener fecha de expiración y dueño. Al expirar, el PR que la renueva debe incluir plan de remediación concreta.

## Flujo cuando guardrail falla

1. **CI falla** → PR bloqueado
2. Developer revisa diff: `npm run guardrails:ocr-parser` muestra qué falta
3. Dos opciones:
   - **Portar fix** (preferido): implementar lo que falta en PWA
   - **Documentar divergencia**: añadir entrada en tabla de excepciones con justificación, fecha, dueño
4. Si se documenta: actualizar `07-known-bugs.md` con estado "WONTFIX - divergencia intencional" + referencia a excepción
5. Re-push → CI pasa

## Métricas de salud

| Métrica | Target | Actual |
|---------|--------|--------|
| Guardrails passing en CI | 100% | 0% (no implementados) |
| Excepciones activas | ≤ 5 | 4 |
| Tiempo medio fix derivación | < 7 días | N/A |
| Bugs App replicados en PWA | 100% P0/P1 | ~0% (histórico) |

## Referencias

- `./07-known-bugs.md` — Catálogo bugs (fuente de verdad para sync)
- `./04-invariants.md` — Invariantes I-33, I-41, I-42 (paridad obligatoria)
- `brigadaApp/ai-context/07-known-bugs.md` — Catálogo móvil (162 líneas, ~100 entradas)
- `./branching-rules.md` — `pre-push` hook ejecuta `guardrails:check`