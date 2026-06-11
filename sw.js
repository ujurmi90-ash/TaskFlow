// TaskFlow Service Worker — Cache-first strategy for offline & instant load
const CACHE_NAME = 'taskflow-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/main.js',
  '/js/config.js',
  '/js/services/auth.js',
  '/js/services/database.js',
  '/js/services/gmail.js',
  '/js/services/csvImporter.js',
  '/js/services/sync.js',
  '/js/components/App.js',
  '/js/components/AuthScreen.js',
  '/js/components/Sidebar.js',
  '/js/components/Dashboard.js',
  '/js/components/DailyLog.js',
  '/js/components/KanbanBoard.js',
  '/js/components/ByPerson.js',
  '/js/components/EmailView.js',
  '/js/components/EmailDetailModal.js',
  '/js/components/TaskModal.js',
  '/js/components/ReplyModal.js',
  '/js/components/ImportModal.js',
  '/js/components/TeamModal.js',
  '/js/components/Toast.js',
  '/icon-512.png',
  '/manifest.json'
];

// Install — pre-cache all core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core assets');
      return cache.addAll(ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// Fetch — cache-first for local assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip Google API calls, OAuth, and other external requests — always go to network
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cache immediately, but also fetch updated version in background
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cached); // If network fails, cached version is already returned

        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
