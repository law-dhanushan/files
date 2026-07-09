// Service Worker for PWA offline support and caching
const CACHE_NAME = 'file-management-v1';
const urlsToCache = [
  '/files/',
  '/files/index.html',
  '/files/manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://accounts.google.com/gsi/client',
  'https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(error => {
        console.log('Fetch error:', error);
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || new Response('Offline - Please try again when connection is restored', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      });
    })
  );
});

// Handle background sync for data updates
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncDataWithCloud());
  }
});

async function syncDataWithCloud() {
  try {
    const client = await clients.matchAll();
    if (client.length > 0) {
      client[0].postMessage({
        type: 'SYNC_DATA',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.log('Sync error:', error);
  }
}
