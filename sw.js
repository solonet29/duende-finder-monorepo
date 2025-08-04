// sw.js - Service Worker Básico

// Evento 'install': se dispara cuando el service worker se instala por primera vez.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalado');
  // self.skipWaiting(); // Opcional: activa el nuevo service worker inmediatamente.
});

// Evento 'activate': se dispara cuando el service worker se activa.
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activado');
});

// Evento 'fetch': se dispara cada vez que la página realiza una petición de red (imágenes, APIs, etc.).
// ¡Este es el evento CLAVE para que la PWA sea instalable!
self.addEventListener('fetch', (event) => {
  // Simplemente pasamos la petición a la red. No hacemos caché aún.
  // Pero el simple hecho de gestionar este evento cumple el requisito.
  event.respondWith(fetch(event.request));
});