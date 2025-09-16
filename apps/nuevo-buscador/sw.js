// sw.js - Service Worker con Estrategia de Caché para Imágenes

const STATIC_CACHE_NAME = 'duende-static-v1'; // Para assets de la app
const DYNAMIC_CACHE_NAME = 'duende-images-v1'; // Para imágenes dinámicas
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/assets/favicon.png',
    '/assets/manifest.json',
    '/assets/flamenco-placeholder.png',
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;700;900&family=Montserrat:wght@700&display=swap',
    'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js',
    'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js'
];

// Evento 'install': se dispara cuando el service worker se instala.
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            console.log('Service Worker: Cacheando assets estáticos');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Evento 'activate': se dispara cuando el service worker se activa.
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                        console.log('Service Worker: Borrando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Evento 'fetch': se dispara para cada petición.
self.addEventListener('fetch', (event) => {
    // Estrategia 1: Stale-While-Revalidate para imágenes
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.open(DYNAMIC_CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                const fetchedResponsePromise = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
                return cachedResponse || fetchedResponsePromise;
            })
        );
        return; // Terminamos aquí para las imágenes
    }

    // Estrategia 2: Cache First (con fallback a la red) para assets estáticos
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});


// Evento 'push': se dispara cuando se recibe una notificación push.
self.addEventListener('push', (event) => {
  console.log('Service Worker: Notificación Push Recibida.');
  const pushData = event.data.json();

  const title = pushData.title || 'Duende Finder';
  const options = {
    body: pushData.body || 'Hay nuevos eventos flamencos cerca de ti.',
    icon: pushData.icon || 'favicon.png',
    badge: pushData.badge || 'favicon.png',
    data: {
      url: pushData.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Evento 'notificationclick': se dispara cuando el usuario hace clic en la notificación.
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Clic en Notificación.');
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});