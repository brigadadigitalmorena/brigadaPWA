# Iconos PWA

Esta carpeta debe contener los iconos de la aplicación en diferentes tamaños.

## Tamaños requeridos

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

## Cómo generar los iconos

### Opción 1: Usar un generador online

1. Prepara una imagen de alta resolución (mínimo 512x512px)
2. Usa un generador como:
   - https://www.pwabuilder.com/imageGenerator
   - https://realfavicongenerator.net/
   - https://favicon.io/

3. Descarga los iconos generados y colócalos en esta carpeta

### Opción 2: Usar ImageMagick

```bash
# Instalar ImageMagick (macOS)
brew install imagemagick

# Generar iconos desde una imagen fuente
convert source.png -resize 72x72 icon-72x72.png
convert source.png -resize 96x96 icon-96x96.png
convert source.png -resize 128x128 icon-128x128.png
convert source.png -resize 144x144 icon-144x144.png
convert source.png -resize 152x152 icon-152x152.png
convert source.png -resize 192x192 icon-192x192.png
convert source.png -resize 384x384 icon-384x384.png
convert source.png -resize 512x512 icon-512x512.png
```

### Opción 3: Usar Figma/Photoshop

1. Diseña el icono en 512x512px
2. Exporta en los diferentes tamaños requeridos
3. Guarda como PNG con fondo transparente (opcional)

## Requisitos

- Formato: PNG
- Fondo: Transparente o sólido (recomendado)
- Color: Visible en fondo claro y oscuro
- Tamaño mínimo: 192x192px para Chrome

## Nota

Actualmente no hay iconos en esta carpeta. La PWA funcionará pero no se podrá instalar hasta que agregues los iconos.
