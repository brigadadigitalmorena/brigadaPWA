# Auto-Instalación PWA y Credenciales Mobile

## ✅ Cambios Implementados

### 1. **Auto-Instalación de PWA**

La PWA ahora se instala automáticamente usando un prompt personalizado que aparece después de 3 segundos de que el usuario ingrese al dashboard.

#### Características:
- ✅ **Prompt personalizado**: Modal atractivo con beneficios de la instalación
- ✅ **Smart timing**: Aparece después de 3 segundos para no interrumpir
- ✅ **No molestar**: Si el usuario lo descarta, no aparece de nuevo por 24 horas
- ✅ **Límite de veces**: Después de 3 descartes, espera 7 días
- ✅ **Detección automática**: No aparece si ya está instalada

#### Archivos creados:
- `src/hooks/use-install-prompt.ts` - Hook para manejar el evento de instalación
- `src/components/common/install-prompt.tsx` - Componente modal de instalación

#### Cómo funciona:

1. **Captura del evento**: El hook captura el evento `beforeinstallprompt` del navegador
2. **Detección de instalación**: Verifica si la app ya está instalada usando `display-mode: standalone`
3. **Timing inteligente**: 
   - Espera 3 segundos antes de mostrar el prompt
   - No aparece si el usuario lo descartó en las últimas 24 horas
   - Después de 3 descartes, espera 7 días
4. **Instalación con un clic**: El usuario hace clic en "Instalar app" y el navegador muestra el prompt nativo

#### Lógica de descartes:

```typescript
// Guardado en localStorage
- install_prompt_dismissed_at: timestamp del último descarte
- install_prompt_dismissed_count: número de veces descartado

// Reglas:
- Si descartó hace menos de 24 horas → no mostrar
- Si descartó 3+ veces y hace menos de 7 días → no mostrar
- En cualquier otro caso → mostrar
```

### 2. **Credenciales de Mobile**

La PWA ahora usa los mismos endpoints de autenticación que la aplicación móvil, lo que permite a los brigadistas usar las mismas credenciales en ambas plataformas.

#### Cambios realizados:

**Antes (CMS):**
```typescript
POST /auth/login
POST /auth/logout
POST /auth/refresh
```

**Ahora (Mobile):**
```typescript
POST /mobile/login
POST /mobile/token/refresh
```

#### Archivos modificados:
- `src/lib/api/auth.service.ts` - Cambiado `/auth/login` → `/mobile/login`
- `src/lib/api/client.ts` - Ya usaba `/mobile/token/refresh`

#### Beneficios:
- ✅ **Misma cuenta**: Los brigadistas usan las mismas credenciales en mobile y PWA
- ✅ **Tokens compatibles**: Los JWT funcionan en ambas plataformas
- ✅ **Sincronización**: Los datos se sincronizan correctamente entre mobile y PWA
- ✅ **Mantenimiento**: Un solo sistema de autenticación

## 🧪 Cómo Probar

### Prueba de Auto-Instalación:

1. **Iniciar el servidor:**
   ```bash
   cd brigada-pwa
   npm run dev
   ```

2. **Abrir en navegador:**
   - Chrome/Edge: http://localhost:3000
   - Asegúrate de NO estar en modo incógnito
   - Asegúrate de que el Service Worker esté registrado

3. **Login:**
   - Usa credenciales de mobile: `admin@brigada.com` / `admin123`
   - O: `encargado@brigada.com` / `encargado123`
   - O: `brigadista@brigada.com` / `brigadista123`

4. **Esperar el prompt:**
   - Después de 3 segundos en el dashboard, aparecerá el modal de instalación
   - Haz clic en "Instalar app"
   - El navegador mostrará el prompt nativo de instalación

5. **Probar descartes:**
   - Haz clic en "Ahora no"
   - Recarga la página
   - El prompt NO debe aparecer de nuevo inmediatamente
   - Para probar de nuevo, limpia localStorage:
     ```javascript
     localStorage.removeItem('install_prompt_dismissed_at');
     localStorage.removeItem('install_prompt_dismissed_count');
     ```

### Prueba de Credenciales Mobile:

1. **Verificar login:**
   - Abre DevTools → Network tab
   - Haz login con credenciales de mobile
   - Verifica que la request sea a `/mobile/login`
   - Verifica que la respuesta contenga `access_token` y `refresh_token`

2. **Verificar refresh token:**
   - Espera a que el token expire (o modifícalo en localStorage)
   - Verifica que se haga una request a `/mobile/token/refresh`
   - Verifica que se obtenga un nuevo access_token

3. **Verificar endpoints:**
   ```javascript
   // En la consola del navegador:
   localStorage.getItem('brigada_access_token'); // Debe existir
   sessionStorage.getItem('brigada_refresh_token'); // Debe existir
   ```

## 📱 Instalación en Dispositivos

### Chrome (Desktop):
1. Abre http://localhost:3000 (o URL de producción)
2. Espera el prompt automático O haz clic en el icono de instalación en la barra de direcciones
3. Haz clic en "Instalar"

### Chrome (Android):
1. Abre la URL en Chrome
2. Espera el prompt automático O toca el menú → "Instalar aplicación"
3. Confirma la instalación

### Safari (iOS):
1. Abre la URL en Safari
2. Toca el botón de compartir (cuadrado con flecha)
3. Selecciona "Agregar a pantalla de inicio"
4. Confirma

### Edge (Desktop):
1. Abre la URL en Edge
2. Espera el prompt automático O haz clic en el icono de instalación
3. Confirma la instalación

## 🔧 Configuración Avanzada

### Modificar el timing del prompt:

Edita `src/components/common/install-prompt.tsx`:

```typescript
// Cambiar el delay antes de mostrar el prompt
const timer = setTimeout(() => {
  setIsOpen(true);
}, 3000); // Cambia este valor (en milisegundos)
```

### Modificar las reglas de descartes:

Edita `src/components/common/install-prompt.tsx`:

```typescript
// Cambiar el tiempo de espera después de descartar
if (hoursSinceDismissed < 24 || (count >= 3 && hoursSinceDismissed < 168)) {
  // 24 = horas de espera normal
  // 3 = número de descartes antes de esperar más
  // 168 = horas de espera después de 3 descartes (7 días)
  return;
}
```

### Desactivar el prompt automático:

Si quieres que el usuario instale manualmente:

```typescript
// En src/app/(dashboard)/layout.tsx, comenta o elimina:
// <InstallPrompt />
```

Y agrega un botón manual en el sidebar o en la página de configuración.

## 🎨 Personalización del Modal

El modal de instalación usa shadcn/ui y se puede personalizar fácilmente:

### Cambiar el diseño:

Edita `src/components/common/install-prompt.tsx`:

```typescript
<DialogContent className="sm:max-w-md">
  {/* Cambia el contenido aquí */}
  <DialogHeader>
    <DialogTitle>...</DialogTitle>
    <DialogDescription>...</DialogDescription>
  </DialogHeader>
  
  <div className="py-4">
    {/* Cambia los beneficios aquí */}
  </div>
  
  <DialogFooter>
    {/* Cambia los botones aquí */}
  </DialogFooter>
</DialogContent>
```

### Cambiar los iconos:

```typescript
import { Download, X, Smartphone, Wifi, Zap } from 'lucide-react';

// Usa diferentes iconos de lucide-react
<Download className="w-6 h-6 text-primary" />
<Smartphone className="w-5 h-5" />
<Wifi className="w-5 h-5" />
<Zap className="w-5 h-5" />
```

## 🐛 Troubleshooting

### El prompt no aparece:

1. **Verifica que el Service Worker esté registrado:**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(console.log);
   ```

2. **Verifica que no esté instalada:**
   ```javascript
   window.matchMedia('(display-mode: standalone)').matches;
   ```

3. **Verifica localStorage:**
   ```javascript
   console.log(localStorage.getItem('install_prompt_dismissed_at'));
   console.log(localStorage.getItem('install_prompt_dismissed_count'));
   ```

4. **Limpia y recarga:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

### El login falla:

1. **Verifica que el backend esté corriendo:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Verifica las credenciales:**
   - Usa las mismas que en mobile
   - admin@brigada.com / admin123
   - encargado@brigada.com / encargado123
   - brigadista@brigada.com / brigadista123

3. **Verifica el endpoint:**
   - Abre DevTools → Network
   - Busca la request a `/mobile/login`
   - Verifica que el status sea 200

### El token no se refresca:

1. **Verifica el refresh token:**
   ```javascript
   sessionStorage.getItem('brigada_refresh_token');
   ```

2. **Verifica la request de refresh:**
   - Abre DevTools → Network
   - Busca la request a `/mobile/token/refresh`
   - Verifica que el status sea 200

3. **Forza un refresh:**
   ```javascript
   // En la consola:
   localStorage.removeItem('brigada_access_token');
   location.reload();
   ```

## 📊 Métricas y Analytics

Para trackear la instalación de la PWA, puedes agregar analytics:

```typescript
// En use-install-prompt.ts
const install = async () => {
  // ... código existente
  
  if (choiceResult.outcome === 'accepted') {
    // Track installation
    analytics.track('pwa_installed', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
    
    // ... resto del código
  }
};
```

## 🚀 Deployment

La auto-instalación funciona en producción con:
- ✅ HTTPS obligatorio
- ✅ Service Worker registrado
- ✅ Manifest.json válido
- ✅ Iconos en los tamaños correctos

## 📚 Recursos

- [Web.dev: PWA Installation](https://web.dev/learn/pwa/installation)
- [MDN: beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)
- [Chrome: PWA Installation](https://developer.chrome.com/docs/devtools/progressive-web-apps)

---

**Estado**: ✅ Implementado y probado
**Última actualización**: 2026-07-21
