/* Enzo Homoeo — service worker
   Caches the app shell so it opens instantly and works offline.
   Bump CACHE when you change the shell file list so users get the update. */
const CACHE = 'enzo-v8';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/core.js',
  './js/store.js',
  './js/api.js',
  './js/workflow.js',
  './js/ui.js',
  './js/auth.js',
  './js/booking.js',
  './js/consultation.js',
  './js/online.js',
  './js/dashboard.js',
  './js/timeline.js',
  './js/patients.js',
  './js/reminders.js',
  './js/settings.js',
  './js/theme.js',
  './assets/favicon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/logo-horizontal.png',
  './assets/logo-mark.png'
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
// other GETs use cache-first, then network (with cache refresh).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin && req.mode !== 'navigate') return; // never intercept the Apps Script API

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && new URL(req.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
