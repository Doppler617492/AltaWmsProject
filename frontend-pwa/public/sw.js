/* Basic PWA service worker for offline shell */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Let network handle most requests; optionally add caching here later.
self.addEventListener('fetch', (event) => {
  // pass-through
});

