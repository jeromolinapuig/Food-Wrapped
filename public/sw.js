self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Optional basic cache passthrough (no caching logic to keep it simple)
self.addEventListener('fetch', () => {});
