const CACHE_NAME = 'smart-eyeglasses-live-shell-v13';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './glasses-viewer.js',
  './config.js',
  './smart-glasses-logo.svg',
  './manifest.webmanifest',
  './pwa-icon-192.png',
  './pwa-icon-512.png',
  './assets/models/base.stl'
];

self.addEventListener('install', event => {
  // Install the shell even if an optional asset is temporarily unavailable.
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(APP_SHELL.map(async path => {
        try {
          const response = await fetch(path, { cache: 'reload' });
          if (response.ok) await cache.put(path, response);
        } catch (error) {
          console.warn('Could not precache:', path, error);
        }
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isHtmlOrAppScript = /\/(?:index\.html|app\.js|config\.js|glasses-viewer\.js)$/.test(path) || path.endsWith('/');

  if (isHtmlOrAppScript) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' })).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
