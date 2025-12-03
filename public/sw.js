/* eslint-disable no-restricted-globals */
// Handi Web Push Service Worker
// Listens for push events and displays notifications.

// ---- ConfiguraciÃ³n offline y utilidades ----
const DEBUG = false;
function log(...args) { if (DEBUG) { try { console.log('SW', ...args); } catch (_) {} } }
const CACHE_VERSION = 'handi-v1';
const PRECACHE = [
  '/',                 // start_url
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable_icon.png',
  '/images/handifav_fondo.png',
  '/images/handifav_sinfondo.png',
].filter(Boolean);

self.addEventListener('install', (event) => {
  // Precache mÃ­nimo: start_url, manifest e Ã­conos
  log('install');
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  // @ts-ignore
  self.skipWaiting?.();
});

self.addEventListener('activate', (event) => {
  // Limpia caches antiguos y toma control
  log('activate');
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE_VERSION ? caches.delete(k) : undefined)))
      )
      // @ts-ignore
      .then(() => self.clients.claim())
  );
});

// Estrategia: Network-first para GET same-origin; fallback a cachÃ© y a /offline.html si falla.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Log bÃ¡sico en DEBUG para diagnÃ³sticos sin ruido
  if (DEBUG && req.mode === 'navigate') log('fetch navigate', url.pathname);
  // Only handle GET
  if (req.method !== 'GET') return;
  // Only same-origin
  if (url.origin !== self.location.origin) return;
  // Avoid API or special backends
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/supabase/')) return;

  // Nota: se usa Accept para detectar HTML; no se requiere isNavigate

  // Network first with fallback
  event.respondWith((async () => {
    try {
      // Intento red
      const netRes = await fetch(req);
      // Cachea en segundo plano si es 200 y bÃ¡sico
      if (netRes && netRes.status === 200 && netRes.type === 'basic' && PRECACHE.includes(url.pathname)) {
        try {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, netRes.clone()).catch(() => {});
        } catch (_) {}
      }
      return netRes;
    } catch (_) {
      // Sin red: intenta cachÃ©; para navegaciones, responde offline
      const cacheRes = await caches.match(req);
      if (cacheRes) return cacheRes;
      // Si pide HTML, sirve offline.html
      if (req.headers.get('accept')?.includes('text/html')) {
        const off = await caches.match('/offline.html');
        if (off) return off;
        return new Response('<!doctype html><title>Sin conexiÃ³n</title><h1>Sin conexiÃ³n</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      // Ãšltimo recurso: a falta de todo, una respuesta vacÃ­a con 503
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});

// (parsePushData eliminado: no se usa; usamos event.data?.json?.())

self.addEventListener('push', (event) => {
  try {
    log('push');
    let data = {};
    try {
      // eslint-disable-next-line no-unused-expressions
      data = event.data?.json?.() ?? {};
    } catch (_) {}
    const title = data.title || 'Handi';
    // Minimal options per spec
    const options = {
      body: (data && data.body) ? data.body : '',
      icon: '/images/handifav_fondo.png',
      badge: '/images/handifav_fondo.png',
      data: data ? data.data : undefined,
    };

    // @ts-ignore
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // noop
  }
});

self.addEventListener('notificationclick', (event) => {
  log('notificationclick');
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
  event.waitUntil(
    // @ts-ignore
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const cUrl = (client && client.url) ? client.url : '';
          // @ts-ignore
          if (cUrl === url && 'focus' in client && client.focus) {
            // @ts-ignore
            return client.focus();
          }
        } catch (_) { /* ignore */ }
      }
      // @ts-ignore
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Attempt to auto-resubscribe on key rotation
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      // @ts-ignore
      const reg = await self.registration;
      const cur = await reg.pushManager.getSubscription();
      if (!cur) return;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ subscription: cur }),
      });
    } catch (_) {
      // ignore
    }
  })());
});

// ComunicaciÃ³n con la pÃ¡gina para coordinar actualizaciones
self.addEventListener('message', (event) => {
  // Permitir string directo o objeto { type }
  const raw = event?.data;
  const type = typeof raw === 'string' ? raw : (raw && raw.type);
  if (type === 'SKIP_WAITING') {
    log('SKIP_WAITING recibido');
    // @ts-ignore
    self.skipWaiting?.();
  }
});

