/* VULNDEX service worker — offline app shell + runtime font cache.
   Bump CACHE on any asset change to invalidate. */
const CACHE = 'vulndex-v3';
const SHELL = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/vulns.js',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate so the app works offline after first load.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.host)) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(req).then(hit => {
          const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // Big, rarely-changing data file: cache-first (don't re-download 5MB each load).
    if (url.pathname.endsWith('/assets/js/vulns.js')) {
      e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        }))
      );
      return;
    }
    // App shell (html/css/js/manifest): network-first so updates show immediately
    // when online; fall back to cache (then index.html) when offline.
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
});
