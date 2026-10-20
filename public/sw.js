// ============================================================
// NikNote 6.0 — Service Worker (Network-First App Assets)
// Cache version MUST match App.tsx SW_VERSION ('v6.0.0')
// Never serves stale JS/CSS bundles on mobile browsers.
// ============================================================

const CACHE_VERSION = 'v6.0.0';
const SHELL_CACHE = `niknote-shell-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('groq.com') || url.hostname.includes('googleapis.com') || url.hostname.includes('openai.com')) return;

  // Always network-first for HTML, JS, CSS so phones get every update immediately
  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/') || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Fonts/images: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached || new Response('', { status: 503 }));
      return cached || networkFetch;
    })
  );
});
