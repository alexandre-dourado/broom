// ============================================================
// THE BROOM — sw.js
// Conservative strategy: cache static assets only
// API calls always go network-first (no stale data risk)
// Works on any domain / subdirectory (paths are relative to SW scope)
// ============================================================

const CACHE_NAME = 'thebroom-v2';

// self.registration.scope gives the full URL of the scope
// We build asset URLs relative to it so this works on any host/path
const STATIC_FILES = [
  'index.html',
  'styles.css',
  'icons.js',
  'db.js',
  'api.js',
  'ui.js',
  'app.js',
  'manifest.json'
];

// ============================================================
// INSTALL — pre-cache static assets
// ============================================================

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const base = self.registration.scope;
      return cache.addAll(STATIC_FILES.map(f => base + f));
    }).then(() => self.skipWaiting())
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

  // Same-origin static assets → cache-first, fallback to network
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
      }).catch(() => caches.match(self.registration.scope + 'index.html'))
    );
    return;
  }

  // Everything else → network passthrough
  event.respondWith(fetch(request));
});

