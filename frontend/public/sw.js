// Service Worker for TriSphere - Offline Support
// __BUILD_VERSION__ is replaced at build time by a Vite plugin (see
// vite.config.js -> bumpServiceWorkerVersion). Without that auto-bump, the
// cache key stays identical across deploys, so users serve stale JS bundles
// from the SW cache forever — which is exactly what was happening before.
const CACHE_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = 'trisphere-' + CACHE_VERSION;
const RUNTIME_CACHE = 'trisphere-runtime-' + CACHE_VERSION;

// Static assets to cache on install.
//
// IMPORTANT: only list paths that REALLY exist in the production build.
// We used to precache `/src/main.jsx`, `/src/App.jsx`, `/src/index.css`
// here, but Vite bundles those into hash-named files under `/assets/*`
// in production — those source paths 404 on the live site. Since
// `cache.addAll()` is atomic (one failure = whole batch fails), the
// precache was silently dying on every install, which is why
// PWABuilder kept flagging "no service worker detected" even though
// the SW was technically registered. The JS / CSS bundles have hashed
// names that change every build, so we can't list them statically;
// they get picked up by the runtime cache on first fetch instead.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon-apple-180.png',
  '/pdf.worker.min.js',
  '/avatars/alien.png',
  '/avatars/astronaut.png',
  '/avatars/cyber_samurai.png',
  '/avatars/dragon.png',
  '/avatars/ethereal_spirit.png',
  '/avatars/inferno_knight.jpg',
  '/avatars/mystic_shinobi.png',
  '/avatars/ninja.png',
  '/avatars/robot.png',
  '/avatars/shonen_hero.png',
  '/avatars/superhero.png',
  '/avatars/unicorn.png',
  '/avatars/wizard.png',
  '/frames/bronze.png',
  '/frames/silver.png',
  '/frames/gold.png',
  '/frames/platinum.png',
  '/frames/diamond.png'
];

// Install event - cache static assets.
//
// Per-asset try/catch (instead of cache.addAll which is atomic) so a
// single 404 on, say, an icon never blows away the rest of the
// precache. PWABuilder's offline check needs at least `/` to be in
// the cache to pass; this guarantees it gets there even if a peripheral
// asset is missing on a given deploy.
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        STATIC_ASSETS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (err) {
            console.warn(`[SW] Precache skipped ${url}:`, err.message);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    // DO NOT intercept Firebase, Firestore, or other external APIs
    // Let the browser/SDKs handle these directly
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // For static assets (CSS, JS, images)
  if (request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // For API requests
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Default: network first
  event.respondWith(networkFirstStrategy(request));
});

// Cache-first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    // Only cache successful GET requests
    if (response && response.status === 200 && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Fetch failed; returning offline page instead.', error);
    // Return a fallback response if available
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

// Network-first strategy (for dynamic content)
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    // Only cache GET requests (Cache API doesn't support POST/PUT/DELETE)
    if (response && response.status === 200 && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Network fetch failed, checking cache for:', request.url);
    
    // For navigation requests, try to return the cached root '/' 
    // This solves the 'dashboard/student' reload issues
    if (request.mode === 'navigate') {
      const cachedRoot = await caches.match('/');
      if (cachedRoot) {
        console.log('[SW] Serving cached root for navigation');
        return cachedRoot;
      }
    }

    // Only try to get from cache for GET requests
    if (request.method === 'GET') {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
    }

    // If we're here, network failed and no cache hit
    console.error('[SW] Both network and cache failed for:', request.url);
    throw error;
  }
}

// Background sync for queued uploads
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'sync-lesson-plans') {
    event.waitUntil(syncLessonPlans());
  } else if (event.tag === 'sync-assignments') {
    event.waitUntil(syncAssignments());
  }
});

async function syncLessonPlans() {
  console.log('Syncing queued lesson plans...');

  // Get queued items from IndexedDB
  const db = await openDB();
  const tx = db.transaction('syncQueue', 'readonly');
  const store = tx.objectStore('syncQueue');
  const items = await store.getAll();

  for (const item of items) {
    if (item.type === 'lesson-plan') {
      try {
        // Send to server
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        });

        // Remove from queue on success
        const deleteTx = db.transaction('syncQueue', 'readwrite');
        await deleteTx.objectStore('syncQueue').delete(item.id);
      } catch (error) {
        console.error('Failed to sync lesson plan:', error);
      }
    }
  }
}

async function syncAssignments() {
  console.log('Syncing queued assignments...');
  // Similar to syncLessonPlans
}

// Helper to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TriSphereOffline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('lessonPlans')) {
        db.createObjectStore('lessonPlans', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('textbooks')) {
        db.createObjectStore('textbooks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }
    };
  });
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    caches.open(RUNTIME_CACHE).then((cache) => {
      cache.addAll(urls);
    });
  }
});
