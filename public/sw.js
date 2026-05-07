const CACHE_NAME = 'edunook-offline-vault-v3';
const ASSETS_TO_CACHE = [
  '/favicon.png',
  '/logo.png'
];

// Install Event - Pre-cache critical assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
    ])
  );
});

// Fetch Event - Network-first with cache fallback (only for static assets)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept Next.js build chunks, HMR, or API routes — let them pass through
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('__next') ||
    url.pathname.includes('webpack')
  ) {
    return;
  }

  // Only cache static assets (images, fonts, icons)
  const isStaticAsset = /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('', { status: 408, statusText: 'Offline' });
        });
      })
  );
});
