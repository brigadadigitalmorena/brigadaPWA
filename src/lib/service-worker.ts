const isDev =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
const enableInDev =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_ENABLE_SW_DEV === 'true';

async function clearServiceWorkerCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/**
 * Dev: always tear down any existing SW + caches so localhost never gets stuck
 * on a stale worker (avoids manual Application → Unregister).
 * Prod: register and listen for updates.
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  if (isDev && !enableInDev) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    await unregisterServiceWorker({ clearCaches: true });
    console.info(
      '[brigada] Service Worker disabled in development (unregistered + caches cleared).'
    );
    // Old SW may still control this tab until a reload.
    if (hadController) {
      window.location.reload();
    }
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('Service Worker registered successfully:', registration);

    registration.active?.postMessage({
      type: 'WARM_URLS',
      urls: [
        '/',
        '/surveys',
        '/sync',
        '/maps',
        '/recorridos',
        '/drafts',
        '/extras',
        '/offline.html',
      ],
    });

    // Already-waiting update from a previous visit
    if (registration.waiting) {
      window.dispatchEvent(new CustomEvent('sw-update-available'));
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New content is available; please refresh.');
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });

    // Periodic update check (tabs left open for a long time)
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 60 * 1000);
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

export async function unregisterServiceWorker(options?: {
  clearCaches?: boolean;
}): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (options?.clearCaches !== false) {
    await clearServiceWorkerCaches();
  }

  console.log('Service Worker unregistered');
}

/** Activate waiting worker then reload once (prod update toast). */
export async function applyWaitingServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;

  if (!waiting) {
    window.location.reload();
    return;
  }

  const reloadOnce = () => {
    navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
  waiting.postMessage({ type: 'SKIP_WAITING' });

  // Fallback if controllerchange never fires
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}
