# Auto-Instalación PWA y Credenciales Mobile

## ✅ Cambios Implementados

### 1. **Auto-Instalación de PWA**

Al entrar desde el navegador aparece un cartel corto. En Chrome y Edge, el botón Instalar abre el diálogo nativo; al confirmar, el navegador instala la app y la abre en `/home`. En iPhone y iPad el cartel indica Compartir → Agregar a inicio, porque Safari no permite instalar desde la página.

#### Características:
- ✅ **Cartel corto**: Barra fija, visible al entrar en el navegador
- ✅ **Un toque**: Instalar lanza el diálogo del navegador y, si se acepta, abre la app
- ✅ **No molestar**: Si el usuario lo cierra, no aparece de nuevo por 24 horas
- ✅ **Límite de veces**: Después de 3 cierres, espera 7 días
- ✅ **Detección automática**: No aparece si ya está instalada ni dentro de una encuesta

#### Archivos creados:
- `src/hooks/use-install-prompt.ts` - Hook para manejar el evento de instalación
- `src/components/common/install-prompt.tsx` - Cartel de instalación

#### Cómo funciona:

1. **Captura del evento**: El hook captura el evento `beforeinstallprompt` del navegador
2. **Detección de instalación**: Verifica si la app ya está instalada usando `display-mode: standalone`
3. **Timing**:
   - El cartel aparece al entrar desde el navegador
   - No aparece si el usuario lo cerró en las últimas 24 horas
   - Después de 3 cierres, espera 7 días
4. **Instalación con un toque**: Instalar abre el diálogo nativo. Si se acepta, el navegador instala la app y la abre

#### Lógica de descartes:

```typescript
// Guardado en localStorage
- install_banner_dismissed_at: timestamp del último cierre
- install_banner_dismissed_count: número de veces cerrado

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

4. **Cartel de instalación:**
   - Al entrar desde el navegador aparece el cartel
   - Pulsa "Instalar"
   - El navegador muestra su diálogo; al aceptar, instala la app y la abre

5. **Probar el cierre:**
   - Pulsa la X del cartel
   - Recarga la página
   - El cartel no debe volver de inmediato
   - Para probar de nuevo, limpia localStorage:
     ```javascript
     localStorage.removeItem('install_banner_dismissed_at');
     localStorage.removeItem('install_banner_dismissed_count');
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
// En src/app/layout.tsx, comenta o elimina:
// <InstallPrompt />
```

Y agrega un botón manual en el sidebar o en la página de configuración.

## 🎨 Personalización del cartel

El cartel vive en `src/components/common/install-prompt.tsx`. El texto, el botón Instalar y la posición se editan ahí.

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
