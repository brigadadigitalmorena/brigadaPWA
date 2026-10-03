# Diapositivas — Brigada PWA

## Cómo generar

```bash
npx slidev build
```

Salida en `dist/index.html`. Abrir en cualquier navegador.

## Cómo presentar

```bash
npx slidev
```

Abrir la URL que muestra (default: http://localhost:3030).
Navegación: flechas, espacio, click.

## Flujo de actualización

1. Actualiza la documentación en `ai-context/XX-tema.md`
2. Actualiza `ai-context/slides/slides.md` para reflejar los cambios
3. Ejecuta `npx slidev build` para regenerar el HTML

**Regla:** la documentación es la fuente de verdad. Las diapositivas se derivan de ella.

## Estructura

- `slides.md` — contenido de las diapositivas
- `theme/` — tema personalizado (opcional)
- `components/` — componentes Vue reutilizables (opcional)

## Fuentes de contenido

| Slide | Fuente |
|-------|--------|
| Qué es | `ai-context/pwa-cms-mobile-differences.md` |
| Ventajas | `README.md` |
| Arquitectura | `ai-context/pwa-cms-mobile-differences.md` |
| Features | `ai-context/pwa-cms-mobile-differences.md` |
| Demo offline | `ai-context/00-overview.md` |
| Sincronización | `ai-context/pwa-cms-mobile-differences.md` |
