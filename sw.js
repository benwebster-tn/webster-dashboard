/**
 * Service Worker — Webster Command Center PWA
 *
 * Strategy: Network-first with offline fallback.
 * - Always tries the network first (dashboard needs live data)
 * - Caches static assets (fonts, favicon) for faster loads
 * - Shows a minimal offline page if completely disconnected
 */

const CACHE_NAME = 'webster-cc-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://websterinsurancetn.com/wp-content/uploads/2025/07/cropped-Fevicon-32x32.webp',
  'https://websterinsurancetn.com/wp-content/uploads/2025/07/cropped-Fevicon-180x180.webp'
];

// Install: pre-cache static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for static assets
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // API calls (Apps Script RPC) — always go to network
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(JSON.stringify({ ok: false, error: 'Offline — cannot reach server' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Static assets — cache-first, then network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(resp) {
        // Cache successful responses
        if (resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return resp;
      }).catch(function() {
        // If it's a navigation request and we're offline, serve the cached index
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
