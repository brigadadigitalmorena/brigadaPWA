import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

const PAGES_CACHE = 'pages-cache';
const STATIC_CACHE = 'static-resources-cache';
const IMAGES_CACHE = 'images-cache';
const API_CACHE = 'api-cache';

// Injected at build time; also seed critical shell URLs for first-visit offline.
const shellUrls = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/surveys',
  '/sync',
  '/drafts',
  '/extras',
];
const injected = self.__WB_MANIFEST || [];
const precacheEntries = [
  ...injected,
  ...shellUrls.map((url) => ({ url, revision: null })),
];
precacheAndRoute(precacheEntries);

/**
 * Always return a real Response for navigations.
 * Chrome shows ERR_FAILED when respondWith resolves to undefined / rejects.
 */
async function navigationHandler({ request }) {
  const cache = await caches.open(PAGES_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      // Cache fill + dashboard HTML so offline reopen works after one online visit.
      cache.put(request, networkResponse.clone()).catch(() => {});
      return networkResponse;
    }
  } catch {
    /* offline or network error — fall through to cache */
  }

  const url = new URL(request.url);
  const withoutQuery = `${url.origin}${url.pathname}`;

  const cached =
    (await cache.match(request)) ||
    (await cache.match(withoutQuery)) ||
    (await caches.match(request.url, { ignoreSearch: true })) ||
    // App shell fallbacks (keep the SPA alive instead of Chrome ERR_FAILED)
    (await cache.match('/surveys')) ||
    (await caches.match('/surveys')) ||
    (await cache.match('/')) ||
    (await caches.match('/')) ||
    (await caches.match('/offline.html'));

  if (cached) return cached;

  return new Response(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>Sin conexión</h1><p>Abre Brigada en línea al menos una vez y visita tus encuestas para poder usarlas offline.</p><p><a href="/surveys">Ir a encuestas</a></p></body></html>',
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

// Single navigation strategy — do NOT also add a raw fetch listener (double respondWith → ERR_FAILED).
registerRoute(new NavigationRoute(navigationHandler));

registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'WARM_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES_CACHE);
        await Promise.all(
          event.data.urls.map(async (url) => {
            try {
              const response = await fetch(url, { credentials: 'same-origin' });
              if (response.ok) {
                await cache.put(url, response.clone());
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

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

console.log('Service Worker registered (offline navigation safe)');
