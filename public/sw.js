// Service Worker for 山东高考志愿助手
// Gaokao Insight Shandong - PWA Offline Support

const CACHE_NAME = 'gaokao-insight-v1';
const DATA_CACHE_NAME = 'gaokao-data-shandong-2023-2025-v1';

// Core app shell resources (updated at build time, versioned by CACHE_NAME)
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

// Large data resources cached separately so they can be invalidated independently
const DATA_URLS = [
  'data/admissions_shandong_2023_2025.json',
  'data/school_metadata.json',
  'data/data_manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Cache app shell immediately
      const appCache = await caches.open(CACHE_NAME);
      try {
        await appCache.addAll(APP_SHELL_URLS);
      } catch (e) {
        console.warn('[SW] App shell cache failed (some URLs may not exist yet):', e);
      }

      // Cache data files in background — do NOT block install on large files
      const dataCache = await caches.open(DATA_CACHE_NAME);
      for (const url of DATA_URLS) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await dataCache.put(url, response);
          }
        } catch (e) {
          console.warn('[SW] Data cache failed for', url, e);
        }
      }

      // Activate immediately without waiting for old SW to become inactive
      self.skipWaiting();
    })()
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove old caches, but NEVER touch localStorage (user reports are safe)
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter(
            (key) =>
              key !== CACHE_NAME &&
              key !== DATA_CACHE_NAME
          )
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
      // Take control of all pages immediately
      await self.clients.claim();
    })()
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const pathname = url.pathname;

  // Strategy for large data files: Cache-first, fallback to network
  if (DATA_URLS.includes(pathname)) {
    event.respondWith(cacheFirstDataStrategy(event.request, pathname));
    return;
  }

  // Strategy for app shell and JS/CSS assets: Network-first with cache fallback
  event.respondWith(networkFirstAppShellStrategy(event.request));
});

/**
 * Cache-first for large data JSON files.
 * If not in cache, fetch from network and cache for next time.
 */
async function cacheFirstDataStrategy(request, pathname) {
  const cache = await caches.open(DATA_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone and cache in background (don't block response)
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (e) {
    console.warn('[SW] Data fetch failed for', pathname, e);
    return new Response(
      JSON.stringify({ error: 'offline', message: '数据未缓存，请联网后重试' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Network-first for app shell (JS, CSS, HTML).
 * Falls back to cache when offline.
 */
async function networkFirstAppShellStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Update cache in background
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (e) {
    // Offline — try cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // For navigation requests, return index.html for client-side routing
    if (request.mode === 'navigate') {
      const indexFallback = await cache.match('/index.html');
      if (indexFallback) return indexFallback;
    }

    return new Response('离线状态，暂无缓存', { status: 503 });
  }
}

// ── Message handler (future: skip-waiting from UI) ────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Report data cache status
  if (event.data && event.data.type === 'CHECK_DATA_CACHE') {
    const replyPort = event.ports && event.ports[0];
    if (!replyPort) {
      return;
    }
    (async () => {
      try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const results = {};
        for (const url of DATA_URLS) {
          const cached = await cache.match(url);
          results[url] = !!cached;
        }
        replyPort.postMessage({ type: 'DATA_CACHE_STATUS', status: results });
      } catch (e) {
        replyPort.postMessage({ type: 'DATA_CACHE_STATUS', status: {}, error: true });
      }
    })();
  }
});
