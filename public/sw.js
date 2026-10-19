// ============================================================
// NikNote 5.0 — Service Worker
// OFFLINE-FIRST PWA for Indian students
// CRITICAL FIX: HTML pages are ALWAYS network-first (no stale cache)
// Only static assets (JS, CSS, images) use cache-first
// ============================================================

const CACHE_NAME = 'niknote-v5.0.4';
const STATIC_CACHE = 'niknote-static-v5.0.4';
const DYNAMIC_CACHE = 'niknote-dynamic-v5.0.4';

// Static assets to cache on install — ONLY truly static files, NOT HTML
const STATIC_ASSETS = [
  '/manifest.json',
  '/offline.html',
  '/niknote-logo.png',
  '/favicon.ico',
];

// Install event — cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing NikNote 5.0.4 — HTML always fresh');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets only (no HTML)');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Skip waiting to activate immediately — force update on user's phone
  self.skipWaiting();
});

// Activate event — clean old caches (v4.0 and earlier)
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating NikNote 5.0.4 — Clearing ALL old caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        // Delete ALL old caches — no exceptions
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event — routing strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // CRITICAL FIX: HTML pages ALWAYS network-first (never stale cache!)
  // SPA must always get fresh HTML — old HTML references old JS chunks = crash
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  // API calls: network-first (no caching)
  if (url.pathname.startsWith('/rest/') ||
      url.hostname.includes('supabase') ||
      url.hostname.includes('razorpay') ||
      url.hostname.includes('lovable')) {
    event.respondWith(fetch(request).catch(() => {
      // API calls can't be cached — just fail
      return new Response('Offline', { status: 503 });
    }));
    return;
  }

  // Static assets (JS, CSS, images, fonts): stale-while-revalidate
  // These have content hashes in filenames so stale = still valid
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|mp4)$/)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request));
});

// Network-first for HTML — CRITICAL for SPA
async function networkFirstHTML(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache the fresh HTML for true offline (but always try network first)
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Network failed — try cache (offline mode)
    const cached = await caches.match(request);
    if (cached) return cached;
    // No cache either — show offline page
    return caches.match('/offline.html');
  }
}

// Cache-first strategy (for static hashed assets)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy (for dynamic content)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy (for hashed static assets)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
});
