/* ICOC Brain Sports — Service Worker v1.0 */
const CACHE_NAME = 'icoc-omnipo-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/assets/logo-hero.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS.map(url => {
      return new Request(url, {cache: 'no-cache'});
    })).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Network First, Cache Fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Skip Supabase, Mapbox, CDN requests
  if (url.hostname.includes('supabase') || url.hostname.includes('mapbox') ||
      url.hostname.includes('cdn.jsdelivr') || url.hostname.includes('api.mapbox')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
