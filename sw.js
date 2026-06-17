// Service worker minimo do Carvalho Suite.
// Objetivo: satisfazer os criterios de instalacao do Chrome (PWA) e permitir
// que a app abra mesmo com ligacao instavel, sem complicar o armazenamento de dados.
const CACHE_NAME = 'carvalho-suite-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: tenta a rede primeiro (para ir sempre buscar a versao mais recente),
// e só usa a copia em cache se a rede falhar (ex: sem internet por breves momentos).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
