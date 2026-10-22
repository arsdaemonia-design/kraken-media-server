/**
 * ============================================================================
 * KRAKEN MEDIA SERVER — Service Worker (sw.js)
 * Gestiona el caché de App Shell (incluyendo los módulos CSS/JS) y archivos
 * multimedia para reproducción en modo Offline PWA.
 * ============================================================================
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'v5.0.1';
const CACHE_NAME = `kraken-offline-${VERSION}`;
const APP_CACHE = `kraken-app-${VERSION}`;
let offlineMode = false;
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/assets/kraken.ico',
  '/assets/kraken-192.png',
  '/assets/kraken-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/css/kraken.css',
  '/assets/js/head-config.js',
  '/assets/js/tv-lite.js',
  '/assets/js/auth.js',
  '/assets/js/hero_series.js',
  '/assets/js/state.js',
  '/assets/js/video-catalog.js',
  '/assets/js/admin-settings.js',
  '/assets/js/playlists-batch.js',
  '/assets/js/tag-editor.js',
  '/assets/js/audio-player.js',
  '/assets/js/video-player.js',
  '/assets/js/library-render.js',
  '/assets/js/downloader-tools.js',
  '/assets/js/radar-remote.js',
  '/assets/js/lyrics-share.js',
  '/assets/js/app-init.js',
  '/assets/js/console.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    await caches.open(CACHE_NAME);
    const appCache = await caches.open(APP_CACHE);
    await appCache.addAll(APP_SHELL);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (key !== CACHE_NAME && key !== APP_CACHE) return caches.delete(key);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function cacheOnly(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  return new Response('', { status: 504, statusText: 'Offline mode' });
}

async function rangeResponse(request) {
  const range = request.headers.get('Range');
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url);

  if (!cached) {
    return fetch(request);
  }

  if (!range) return cached;

  try {
    const netRes = await fetch(request);
    if (netRes && netRes.ok) return netRes;
  } catch (_) {}

  return cached;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Nunca interceptar /api/status para permitir verificación directa de sesión
  if (url.pathname.startsWith('/api/status')) {
    return;
  }

  if (url.pathname.startsWith('/descargas/')) {
    if (offlineMode) {
      event.respondWith(cacheOnly(event.request, CACHE_NAME));
    } else {
      event.respondWith(rangeResponse(event.request));
    }
    return;
  }

  if (url.pathname.startsWith('/caratula/')) {
    if (offlineMode) {
      event.respondWith(cacheOnly(event.request, CACHE_NAME));
    } else {
      event.respondWith(cacheFirst(event.request));
    }
    return;
  }

  if (APP_SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fetchPromise = fetch(event.request).then(res => {
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      }).catch(() => null);
      if (offlineMode && cached) return cached;
      const netRes = await fetchPromise;
      if (netRes) return netRes;
      return cached || fetch(event.request);
    })());
    return;
  }
});

self.addEventListener('message', event => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];

  if (data.type === 'SET_OFFLINE_MODE') {
    offlineMode = !!data.enabled;
    if (port) port.postMessage({ ok: true, offlineMode });
  }

  if (data.type === 'CACHE_TRACK') {
    event.waitUntil((async () => {
      try {
        if (offlineMode) {
          if (port) port.postMessage({ ok: false, error: 'offline-mode' });
          return;
        }
        const cache = await caches.open(CACHE_NAME);
        const urls = data.urls || [];
        for (const url of urls) {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) await cache.put(url, res.clone());
        }
        if (port) port.postMessage({ ok: true });
      } catch (e) {
        if (port) port.postMessage({ ok: false, error: String(e) });
      }
    })());
  }

  if (data.type === 'REMOVE_TRACK') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const urls = data.urls || [];
        for (const url of urls) {
          await cache.delete(url);
        }
        if (port) port.postMessage({ ok: true });
      } catch (e) {
        if (port) port.postMessage({ ok: false, error: String(e) });
      }
    })());
  }
});
