// CSnote 서비스워커 — 오프라인 지원 (앱 셸 + 데이터 캐시)
const VERSION = 'csnote-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/data.js',
  './assets/js/app.js',
  './config/config.json',
  './config/lang/ko.json',
  './config/lang/en.json',
  './subjects/os.yaml',
  './subjects/net.yaml',
  './subjects/db.yaml',
  './subjects/ds.yaml',
  './subjects/arch.yaml',
  './subjects/os-en.yaml',
  './subjects/net-en.yaml',
  './subjects/db-en.yaml',
  './subjects/ds-en.yaml',
  './subjects/arch-en.yaml',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 동일 출처: stale-while-revalidate (캐시 즉시 응답 + 백그라운드 갱신)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 교차 출처(폰트/CDN): cache-first
  e.respondWith(
    caches.open(VERSION + '-cdn').then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return cached || Response.error();
      }
    })
  );
});
