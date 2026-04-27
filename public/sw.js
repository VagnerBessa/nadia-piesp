// Service Worker — Nadia PWA Cache
// Estratégia: Cache-first para assets estáticos, Network-first para APIs

const CACHE_NAME = 'nadia-v0.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: pré-cacheia o shell básico
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para assets, network-first para APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não cachear APIs externas (Gemini, OpenRouter, Google Fonts CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Para assets (JS, CSS, imagens, parquet, etc.) — Cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Só cacheia respostas válidas
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
