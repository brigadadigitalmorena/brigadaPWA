# Brigada PWA

Progressive Web Application para brigadistas de campo. Permite completar encuestas asignadas con soporte offline-first.

## 🚀 Características

- ✅ **Offline-first**: Trabaja sin conexión, sincroniza automáticamente
- ✅ **PWA**: Instálala en tu dispositivo como app nativa
- ✅ **Responsive**: Funciona en móvil, tablet y desktop
- ✅ **Segura**: Autenticación JWT con refresh tokens
- ✅ **Sincronización en segundo plano**: Los datos se envían automáticamente
- ✅ **Gestión de archivos**: Sube fotos y documentos
- ✅ **GPS**: Captura ubicación automáticamente
- ✅ **Validaciones**: Valida datos en tiempo real

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **UI**: React 18 + shadcn/ui + Tailwind CSS
- **Estado**: Zustand + React Query
- **Base de datos offline**: Dexie.js (IndexedDB)
- **Service Worker**: Workbox
- **Formularios**: React Hook Form + Zod
- **HTTP**: Axios
- **Mapas**: MapLibre GL JS

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local

# Iniciar servidor de desarrollo
npm run dev
```

## 🔧 Configuración

Edita `.env.local` con tus variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000
```

## 📱 Uso como PWA

1. Abre la aplicación en tu navegador
2. Busca el botón "Instalar aplicación" o "Add to Home Screen"
3. La app se instalará como aplicación nativa

## 🔄 Sincronización

La aplicación sincroniza automáticamente cuando:
- Hay conexión a internet
- Hay datos pendientes en la cola
- El usuario fuerza la sincronización manual

### Estados de sincronización

- **Pending**: Datos esperando ser enviados
- **Syncing**: Datos en proceso de envío
- **Synced**: Datos enviados exitosamente
- **Failed**: Error al enviar (se reintentará)
- **Dead Letter**: Error permanente (requiere intervención)

## 📂 Estructura del Proyecto

```
brigada-pwa/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rutas de autenticación
│   ├── (dashboard)/       # Rutas protegidas
│   └── layout.tsx         # Layout principal
├── components/            # Componentes React
│   ├── ui/               # Componentes shadcn/ui
│   ├── survey/           # Componentes de encuesta
│   ├── sync/             # Componentes de sync
│   └── common/           # Componentes comunes
├── contexts/             # React Contexts
├── lib/                  # Utilidades y servicios
│   ├── api/             # API client
│   ├── db/              # Dexie.js database
│   ├── sync/            # Sync engine
│   └── types/           # TypeScript types
├── public/              # Archivos estáticos
│   ├── icons/          # Iconos PWA
│   ├── manifest.json   # PWA manifest
│   └── offline.html    # Página offline
└── workers/            # Service Workers
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Ejecutar tests con coverage
npm run test:coverage

# Ejecutar E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build
docker build -t brigada-pwa .

# Run
docker run -p 3000:3000 brigada-pwa
```

## 📝 Scripts Disponibles

- `npm run dev` - Iniciar servidor de desarrollo
- `npm run build` - Build para producción
- `npm run start` - Iniciar servidor de producción
- `npm run lint` - Ejecutar ESLint
- `npm run type-check` - Verificar tipos TypeScript

## 🔒 Seguridad

- Tokens JWT en localStorage (access) y sessionStorage (refresh)
- HTTPS obligatorio para Service Workers
- Content Security Policy configurado
- Validación de inputs con Zod
- Sanitización de HTML

## 📊 Monitoreo

La aplicación incluye:
- Logs estructurados
- Error tracking (Sentry)
- Analytics (PostHog)
- Performance monitoring

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Privado - Brigada Digital

## 👥 Equipo

Desarrollado por el equipo de Brigada Digital

---

**Nota**: Esta es una PWA que reemplaza/complementa la aplicación móvil nativa, manteniendo la misma experiencia offline-first.
