// ============================================================
// THE BROOM — sw.js
// Conservative strategy: cache static assets only
// API calls always go network-first (no stale data risk)
// Scope: /broom/ (GitHub Pages subdirectory)
// ============================================================

const CACHE_NAME = 'thebroom-v1';

const STATIC_ASSETS = [
  '/broom/',
  '/broom/index.html',
  '/broom/styles.css',
  '/broom/icons.js',
  '/broom/db.js',
  '/broom/api.js',
  '/broom/ui.js',
  '/broom/app.js',
  '/broom/manifest.json'
];

// ============================================================
// INSTALL — pre-cache static assets
// ============================================================

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — clean up old caches
// ============================================================

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — strategy per request type
// ============================================================

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // GAS API calls → always network, never cache
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(request));
    return;
  }

  // Google Fonts → network-first with cache fallback
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets → cache-first
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        });
      }).catch(() => caches.match('/broom/index.html'))
    );
    return;
  }

  // Everything else → network passthrough
  event.respondWith(fetch(request));
});
