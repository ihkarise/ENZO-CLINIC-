/* Enzo Homoeo — service worker
   Caches the app shell so it opens instantly and works offline.
   Bump CACHE when you change index.html so users get the update. */
const CACHE = 'enzo-v6';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Install: cache each shell file individually so one miss doesn't fail install.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// Activate: drop old caches.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: navigations fall back to cached index when offline;
// other GETs use cache-first, then network.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // cache same-origin successful responses for next time
      if (res.ok && new URL(req.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit || caches.match('./index.html')))
  );
});
