import { precacheAndRoute } from 'workbox-precaching';
import {
  registerRoute,
  NavigationRoute,
  setDefaultHandler,
  setCatchHandler,
} from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

const PAGES_CACHE = 'pages-cache-v5';
const STATIC_CACHE = 'static-resources-cache-v4';
const IMAGES_CACHE = 'images-cache-v4';
const API_CACHE = 'api-cache-v4';
// Shared with offline-tiles.service.ts so explicitly downloaded packs are also
// visible to normal MapLibre requests intercepted by this worker.
const OFFLINE_TILE_CACHE = 'brigada-offline-tiles-v1';
const TILE_MANIFEST_CACHE = 'tile-manifest-cache-v1';

// Only immutable files belong in the precache. App HTML (`/`, `/surveys`, …)
// used to be precached with revision:null, which intercepted navigations before
// the handler below and, on a cache miss, rejected the fetch. Chrome then shows
// "Esta página no está disponible" with Recargar; a second load works.
const precacheUrls = ['/offline.html', '/manifest.json'];
const injected = self.__WB_MANIFEST || [];
const precacheEntries = [
  ...injected,
  ...precacheUrls.map((url) => ({ url, revision: null })),
];
precacheAndRoute(precacheEntries);

// Cap every document fetch, including navigation preload. Awaiting preload
// without a limit left the installed app on the splash / "Cargando..." until
// Chrome gave up. Online navigations prefer a fresh document so the HTML and
// the /_next/static chunks stay a pair; a stale shell hydrates into a spinner
// that never finishes after a deploy.
const NAV_NETWORK_TIMEOUT_MS = 4000;

/**
 * Always return a real Response for navigations.
 * Chrome shows ERR_FAILED when respondWith resolves to undefined / rejects.
 */
async function findCachedFillShell(cache) {
  const shell = await cache.match('/surveys/__fill_shell__');
  if (shell) return shell;

  const keys = await cache.keys();
  for (const req of keys) {
    try {
      const path = new URL(req.url).pathname;
      if (/\/surveys\/\d+\/fill\/?$/.test(path)) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
    } catch {
      /* ignore bad keys */
    }
  }
  return undefined;
}

function isAuthRoute(pathname) {
  return (
    pathname === '/login' ||
    pathname === '/activate' ||
    pathname.startsWith('/activate/')
  );
}

function authOfflineResponse() {
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Sin conexión</h1><p>Necesitas conexión para iniciar sesión o activar tu cuenta.</p><p><button onclick="location.reload()" style="font-size:1rem;padding:.75rem 1.25rem;border-radius:12px;border:0;background:#FF1B8D;color:#fff;cursor:pointer">Reintentar</button></p></body></html>',
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

function offlineFallbackResponse() {
  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Sin conexión</h1><p>Abre Brigada en línea al menos una vez y visita tus encuestas para poder usarlas offline.</p><p><button onclick="location.reload()" style="font-size:1rem;padding:.75rem 1.25rem;border-radius:12px;border:0;background:#FF1B8D;color:#fff;cursor:pointer">Reintentar</button></p></body></html>',
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

async function matchPage(cache, request, url) {
  const withoutQuery = `${url.origin}${url.pathname}`;
  return (
    (await cache.match(request)) ||
    (await cache.match(withoutQuery)) ||
    (await cache.match(url.pathname))
  );
}

async function matchOfflineShell() {
  const names = await caches.keys();
  for (const name of names) {
    if (name === OFFLINE_TILE_CACHE || name === IMAGES_CACHE) continue;
    const cache = await caches.open(name);
    const hit = await cache.match('/offline.html');
    if (hit) return hit;
  }
  return undefined;
}

async function storePage(cache, request, response, isFillRoute) {
  try {
    await cache.put(request.url, response.clone());
    if (isFillRoute) {
      await cache.put('/surveys/__fill_shell__', response.clone());
    }
  } catch {
    /* quota, opaque response, or a body already in use */
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('nav-timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function preloadOrFetch(request, event) {
  if (event && event.preloadResponse) {
    try {
      const preloaded = await withTimeout(
        event.preloadResponse,
        NAV_NETWORK_TIMEOUT_MS
      );
      if (preloaded) return preloaded;
    } catch {
      /* preload missing, failed, or slower than the cap */
    }
  }

  return withTimeout(fetch(request), NAV_NETWORK_TIMEOUT_MS);
}

async function refreshPageCache(cache, request, event, isFillRoute) {
  try {
    let response;
    if (event && event.preloadResponse) {
      try {
        response = await event.preloadResponse;
      } catch {
        response = undefined;
      }
    }
    if (!response) {
      response = await fetch(request.url, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
    }
    if (response && response.ok) {
      await storePage(cache, request, response, isFillRoute);
    }
  } catch {
    /* keep the shell already shown */
  }
}

async function handleNavigation({ request, event }) {
  const cache = await caches.open(PAGES_CACHE);
  const url = new URL(request.url);
  const isFillRoute = /\/surveys\/\d+\/fill\/?$/.test(url.pathname);
  const authRoute = isAuthRoute(url.pathname);
  const browserOffline =
    typeof self.navigator !== 'undefined' && self.navigator.onLine === false;

  // Fresh HTML while online. Serving the cached document first kept the
  // installed icon on "Cargando...": that shell pointed at chunk URLs the new
  // deploy no longer has, and the update toast never ran because JS never
  // hydrated. Offline skips the wait and uses the last good copy.
  if (!browserOffline) {
    try {
      const networkResponse = await preloadOrFetch(request, event);
      const redirect =
        networkResponse &&
        networkResponse.status >= 300 &&
        networkResponse.status < 400;
      if (networkResponse && (networkResponse.ok || redirect)) {
        if (networkResponse.ok && event && event.waitUntil && !authRoute) {
          const pageUrl = request.url;
          event.waitUntil(
            (async () => {
              try {
                const again = await fetch(pageUrl, {
                  credentials: 'same-origin',
                  cache: 'no-store',
                });
                if (again && again.ok) {
                  await storePage(cache, request, again, isFillRoute);
                }
              } catch {
                /* keep the response already shown */
              }
            })()
          );
        }
        return networkResponse;
      }
    } catch {
      /* offline, timeout, or network error — fall through to cache */
    }
  }

  // Auth routes: network-only (+ optional exact cache). Never serve / or offline.html.
  if (authRoute) {
    const exact = await matchPage(cache, request, url);
    if (exact) return exact;
    return authOfflineResponse();
  }

  const cached =
    (await matchPage(cache, request, url)) ||
    (isFillRoute ? await findCachedFillShell(cache) : undefined);
  if (cached) return cached;

  // Never serve a different app page (especially "/") — wrong HTML at /surveys|/login
  // remounts Home ("Cargando...") in a redirect loop when prod has warm caches.
  const offline = await matchOfflineShell();
  if (offline) return offline;
  return offlineFallbackResponse();
}

async function navigationHandler(args) {
  try {
    return await handleNavigation(args);
  } catch {
    return offlineFallbackResponse();
  }
}

// Single navigation strategy — do NOT also add a raw fetch listener (double respondWith → ERR_FAILED).
registerRoute(new NavigationRoute(navigationHandler));

// Hashed Next chunks are immutable. CacheFirst keeps the installed app from
// sitting on "Cargando..." while every script revalidates on a slow network.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/_next/static/'),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) =>
    !url.pathname.startsWith('/_next/static/') &&
    (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'worker'),
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 20 * 24 * 60 * 60,
      }),
    ],
  })
);

// Versioned CDN tile paths are immutable. This route is registered before the
// generic image route so map tiles use their dedicated, long-lived cache.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.pathname.includes('/tiles/osm/') &&
    !url.pathname.endsWith('/mobile/tiles/osm/manifest'),
  new CacheFirst({
    cacheName: OFFLINE_TILE_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100000,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

// The API manifest is mutable (short backend TTL), so discovery remains
// network-friendly while the last successful response is available offline.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.endsWith('/mobile/tiles/osm/manifest'),
  new StaleWhileRevalidate({
    cacheName: TILE_MANIFEST_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 5 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: IMAGES_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

// Next.js RSC / flight requests (soft navigations still hit the network)
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    !url.pathname.startsWith('/_next/static/') &&
    (url.pathname.startsWith('/_next/') ||
      request.headers.get('RSC') === '1' ||
      request.headers.get('Next-Router-Prefetch') === '1' ||
      url.searchParams.has('_rsc')),
  new NetworkFirst({
    cacheName: 'next-rsc-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

setDefaultHandler(
  new NetworkFirst({
    cacheName: 'default-cache',
    networkTimeoutSeconds: 3,
  })
);

// A thrown strategy (precache miss, NetworkFirst with an empty cache) must not
// reject the document fetch — that is the Chrome "página no disponible" screen.
setCatchHandler(async ({ request, event }) => {
  if (request.mode === 'navigate') {
    return navigationHandler({ request, event });
  }
  return Response.error();
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'brigada-dexie-sync') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'BRIGADA_SYNC_WAKE' });
          });
        })
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'brigada-dexie-sync') {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'BRIGADA_SYNC_WAKE' });
          });
        })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'WARM_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES_CACHE);
        let savedShell = false;
        await Promise.all(
          event.data.urls.map(async (url) => {
            try {
              // Do not warm/cache auth pages into the app shell.
              if (isAuthRoute(new URL(url, self.location.origin).pathname)) {
                return;
              }
              const response = await fetch(url, { credentials: 'same-origin' });
              if (response.ok) {
                await cache.put(url, response.clone());
                if (!savedShell && /\/surveys\/\d+\/fill/.test(String(url))) {
                  await cache.put('/surveys/__fill_shell__', response.clone());
                  savedShell = true;
                }
              }
            } catch {
              /* ignore warm failures */
            }
          })
        );
      })()
    );
  }
});

const INSTALL_SHELLS = ['/home', '/login', '/welcome', '/'];

async function warmInstallShells() {
  const cache = await caches.open(PAGES_CACHE);
  await Promise.all(
    INSTALL_SHELLS.map(async (path) => {
      try {
        const response = await withTimeout(
          fetch(path, { credentials: 'same-origin' }),
          NAV_NETWORK_TIMEOUT_MS
        );
        if (response && response.ok) await cache.put(path, response);
      } catch {
        /* the next online visit fills this in */
      }
    })
  );
}

// Do not wait on four document downloads: that kept the home-screen icon on
// the splash until Chrome killed the navigation. skipWaiting runs even on
// updates so a phone stuck on the old worker picks this up without the toast
// (that toast only exists after JavaScript hydrates).
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await Promise.race([
        warmInstallShells(),
        new Promise((resolve) => setTimeout(resolve, NAV_NETWORK_TIMEOUT_MS)),
      ]);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keep = new Set([
        PAGES_CACHE,
        STATIC_CACHE,
        IMAGES_CACHE,
        API_CACHE,
        OFFLINE_TILE_CACHE,
        TILE_MANIFEST_CACHE,
        'next-rsc-cache',
        'google-fonts-cache',
        'default-cache',
      ]);
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !keep.has(key) && !key.includes('precache'))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

console.log('Service Worker registered (offline navigation safe)');
