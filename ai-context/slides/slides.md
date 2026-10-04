---
theme: default
title: Brigada PWA
info: |
  ## Brigada PWA
  Progressive Web App para recolección de encuestas
---

# Brigada PWA

Progressive Web App para recolección de encuestas en campo

<div class="abs-br m-6 text-sm opacity-50">
  Brigada PWA · 2026
</div>

---

# Qué es

Aplicación web progresiva que se instala como app nativa:

- **iOS:** "Añadir a pantalla de inicio" desde Safari
- **Android:** "Instalar app" desde Chrome
- **Sin tienda:** no requiere Play Store ni App Store

---

# Ventajas sobre app nativa

| Aspecto | PWA | App nativa |
|---------|-----|-----------|
| Instalación | Sin tienda | Play Store / App Store |
| Actualizaciones | Instantáneas | Review + download |
| Tamaño | ~2MB | ~50MB |
| Offline | Service Worker | Nativo |
| Push | Web Push (VAPID) | FCM / APNs |

---

# Arquitectura

```
PWA (Next.js)  ←→  Backend API (FastAPI)  ←→  Web CMS (Next.js)
```

- **Next.js 14** con App Router
- **Service Worker** para offline y cache
- **IndexedDB (Dexie)** para datos locales
- **Web Push** para notificaciones

---

# Features clave

- Llenado de encuestas (16+ tipos de pregunta)
- OCR de INE on-device
- Sync offline con Service Worker
- Instalación como app nativa
- Notificaciones push (Web Push)
- Mapas offline

---

# Demo: Instalación

1. Abrir en Chrome (Android) o Safari (iOS)
2. Menú → "Instalar app" / "Añadir a pantalla de inicio"
3. La app aparece en el home screen como app nativa
4. Funciona sin conexión una vez instalada

---

# Demo: Llenado de encuestas

Flujo: Login → Encuestas → Llenar → Submit

- Validación en tiempo real
- Draft auto-save en IndexedDB
- Lógica condicional (json-logic)
- Auto-avance

---

# Demo: Offline

1. Instalar la app
2. Activar airplane mode
3. Llenar encuesta completa
4. Submit → cola local
5. Reconectar → sync automático

---

# Demo: OCR de INE

1. Cámara con guía visual
2. ML Kit on-device
3. Extracción automática
4. Corrección cruzada CURP/Clave
5. Autofill a preguntas relacionadas

---

# Sincronización con CMS

- Las encuestas se configuran en el Web CMS
- La PWA descarga los esquemas al iniciar
- Las respuestas se envían al backend
- El CMS muestra analytics y reportes

---

# Casos de uso

- **Brigadistas** que no pueden instalar apps nativas
- **Eventos** donde se necesita acceso rápido sin instalación
- **Zonas rurales** con conectividad intermitente
- **Equipos mixtos** (algunos con app nativa, otros con PWA)

---

# Preguntas frecuentes

- ¿Funciona sin internet? → Sí, con Service Worker
- ¿Cómo se actualiza? → Automáticamente al abrir
- ¿Ocupa mucho espacio? → ~2MB
- ¿Tiene notificaciones? → Sí, Web Push

---

# ¡Gracias!

Brigada PWA

[GitHub](https://github.com/brigadadigitalmorena/brigadaPWA)
