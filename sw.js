/* ICOC Brain Sports — Service Worker v2.1 */
const CACHE_NAME = 'icoc-omnipo-v4';

// Install — 핵심 파일만 캐시
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['/ICOC-Omnipo2027/index.html', '/ICOC-Omnipo2027/manifest.json'])
        .catch(() => {})
    )
  );
});

// Activate — 이전 캐시 정리
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — 문제 요청 건너뛰기 + Network First
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // ① GET만 처리
  if (req.method !== 'GET') return;

  // ② chrome-extension:// 같은 비HTTP 스킴 건너뜀
  if (!url.protocol.startsWith('http')) return;

  // ③ 외부 API/CDN 건너뜀 (캐시 불필요)
  const skipHosts = [
    'supabase.co', 'mapbox.com', 'mapboxapi.com',
    'api.mapbox.com', 'events.mapbox.com',
    'cdn.jsdelivr.net', 'fonts.googleapis.com',
    'fonts.gstatic.com', 'api.rss2json.com',
    'api.open-meteo.com', 'openfreemap.org',
    'cartocdn.com', 'basemaps.cartocdn.com',
    'flagcdn.com', 'suno.ai', 'udioapi.com',
  ];
  if (skipHosts.some(h => url.hostname.includes(h))) return;

  // ④ 동영상/오디오 Range 요청 건너뜀 (206 방지)
  if (req.headers.get('range')) return;
  const ext = url.pathname.split('.').pop().toLowerCase();
  if (['mp4','webm','mp3','ogg','wav','m4a','mov'].includes(ext)) return;

  // ⑤ Network First, Cache Fallback
  e.respondWith(
    fetch(req)
      .then(response => {
        // 200 OK만 캐시 (206 Partial, 0 opaque 등 제외)
        if (response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(req, clone))
            .catch(() => {}); // 캐시 실패해도 응답은 반환
        }
        return response;
      })
      .catch(() => caches.match(req).then(r => r || new Response('Offline', {status: 503})))
  );
});
