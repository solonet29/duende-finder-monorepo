// sw.js

const CACHE_NAME = 'duende-finder-v1';
// Lista de URLs del App Shell para cachear
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/chatbot.css',
  '/chatbot.js',
  '/search.js',
  '/assets/favicon.png',
  '/assets/flamenco-placeholder.png',
  '/assets/img_header.png',
  '/assets/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@700&display=swap',
  'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// --- 1. Estrategia de Caché: Instalación (Cache First para App Shell) ---
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando el App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .catch(error => {
        console.error('[Service Worker] Falló el cacheo del App Shell:', error);
      })
  );
});

// --- 2. Estrategia de Caché: Activación (Limpieza de cachés viejos) ---
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- 3. Estrategia de Caché: Fetch (Stale-While-Revalidate para API, Cache First para el resto) ---
self.addEventListener('fetch', event => {
  const { request } = event;

  // Estrategia Stale-While-Revalidate para la API
  if (request.url.includes('/api/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          const fetchPromise = fetch(request).then(networkResponse => {
            // Actualizamos el caché con la nueva respuesta
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });

          // Devolvemos la respuesta del caché si existe, si no, esperamos a la red
          return cachedResponse || fetchPromise;
        });
      })
    );
    return; // Importante: salir después de manejar la petición de la API
  }

  // Estrategia Cache First para todo lo demás (App Shell)
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Si la respuesta está en el caché, la devolvemos. Si no, la buscamos en la red.
        return response || fetch(request);
      })
  );
});


// --- LÓGICA EXISTENTE DE NOTIFICACIONES PUSH ---
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Recibido.');
  console.log(`[Service Worker] Datos del push: "${event.data.text()}"`);

  const data = event.data.json(); // Asumimos que el servidor envía un JSON

  const title = data.title || 'Notificación de Duende';
  const options = {
    body: data.body || 'Tienes una nueva notificación.',
    icon: '/favicon.ico', // Opcional: icono para la notificación
    badge: '/favicon.ico' // Opcional: icono para la barra de notificaciones (Android)
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Clic en la notificación recibido.');

  event.notification.close();

  // Abre la ventana de la aplicación si no está ya abierta
  event.waitUntil(
    clients.openWindow('/')
  );
});