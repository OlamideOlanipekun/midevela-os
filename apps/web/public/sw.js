/**
 * Midevela PWA Service Worker — Milestone A
 *
 * Strategies:
 *   • Cache-First       — static assets, fonts, widget JS/CSS
 *   • Stale-While-Reval — /api/widget/init (theme + config)
 *   • Network-First     — all other /api/widget/* routes (fresh data preferred)
 *   • Background Sync   — /api/widget/event analytics (fire-and-forget)
 *   • Offline Shell     — generic offline.html when network is unavailable
 *
 * VERSIONING: Update CACHE_VERSION to force all clients to re-fetch on deploy.
 */

const CACHE_VERSION = 'mv-a1-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_CACHE     = `${CACHE_VERSION}-api`;
const SYNC_TAG      = 'midevela-analytics-sync';

// Resources cached on install for instant offline shell
const PRECACHE_URLS = [
  '/widget/midevela-widget.js',
  '/offline.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Precache skip: ${url}`, err);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept GET and POST; skip non-http(s)
  if (!url.protocol.startsWith('http')) return;
  if (request.method !== 'GET' && request.method !== 'POST') return;

  // ── Analytics events → network-first + offline queue (POST) ───────────
  if (request.method === 'POST' && url.pathname.startsWith('/api/widget/event')) {
    event.respondWith(networkFirst(request));
    event.waitUntil(queueAnalyticsIfOffline(request.clone()));
    return;
  }

  // ── Widget config/init → Stale-While-Revalidate ────────────────────────
  if (
    url.pathname.startsWith('/api/widget/init') ||
    url.pathname.startsWith('/api/widget/config') ||
    url.pathname.startsWith('/api/widget/manifest')
  ) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // ── Other widget API calls → Network-First (fresh data required) ───────
  if (url.pathname.startsWith('/api/widget/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── Static assets (JS, fonts, images) → Cache-First ───────────────────
  if (
    url.pathname.startsWith('/widget/') ||
    /\.(js|css|woff2?|ttf|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushAnalyticsQueue());
  }
});

// ─── Push Notifications (future-ready stub) ───────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Midevela', {
        body: data.body || '',
        icon: data.icon || '/icon-192.png',
        badge: '/badge-96.png',
        data: data.url ? { url: data.url } : {},
      })
    );
  } catch {
    // Non-JSON push — ignore
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

// ─── Caching Strategies ───────────────────────────────────────────────────────

/** Cache-First: return from cache; fetch and update cache if missing. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

/** Stale-While-Revalidate: return cached response immediately, fetch in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const revalidate = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => null);

  return cached || revalidate;
}

/** Network-First: prefer live network, fall back to cache, then offline shell. */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    if (request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      // Offline HTML shell for navigation requests
      if (request.headers.get('accept')?.includes('text/html')) {
        const staticCache = await caches.open(STATIC_CACHE);
        const offline = await staticCache.match('/offline.html');
        if (offline) return offline;
      }
    }
    return new Response(JSON.stringify({ error: 'You appear to be offline.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Analytics Queue (IndexedDB + Background Sync) ────────────────────────────

async function queueAnalyticsIfOffline(request) {
  // Detect offline state by checking navigator (available in SW scope)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const body = await request.text();
      const queue = await readQueue();
      queue.push({
        url: request.url,
        body,
        timestamp: Date.now(),
      });
      await writeQueue(queue);
      if ('sync' in self.registration) {
        await self.registration.sync.register(SYNC_TAG);
      }
    } catch {
      // Analytics is best-effort — silently ignore storage errors
    }
  }
}

async function flushAnalyticsQueue() {
  const queue = await readQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const entry of queue) {
    try {
      const response = await fetch(entry.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: entry.body,
      });
      if (!response.ok) remaining.push(entry);
    } catch {
      remaining.push(entry);
    }
  }
  await writeQueue(remaining);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mv_sw_db', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('analytics_queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function readQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('analytics_queue', 'readonly');
      const req = tx.objectStore('analytics_queue').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('analytics_queue', 'readwrite');
      const store = tx.objectStore('analytics_queue');
      store.clear();
      for (const item of items) store.add(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently ignore — analytics is best-effort
  }
}
