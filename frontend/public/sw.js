const CACHE_NAME = 'etpl-ops-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-16x16.png'
];

const CACHE_STRATEGIES = {
  // Network first for API calls
  api: 'network-first',
  // Cache first for static assets
  static: 'cache-first',
  // Stale while revalidate for HTML
  html: 'stale-while-revalidate'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;
  
  // API calls - Network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Static assets - Cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|woff)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // HTML pages - Stale while revalidate
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Default - Network first
  event.respondWith(networkFirst(event.request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  // Implement offline action sync when back online
  console.log('Syncing offline actions...');
}