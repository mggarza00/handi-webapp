/* eslint-disable no-restricted-globals */
// Handi Web Push Service Worker
// Listens for push events and displays notifications.

self.addEventListener('install', (event) => {
  // Activate immediately on install
  // @ts-ignore
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Take control of uncontrolled clients
    // @ts-ignore
    await self.clients.claim();
  })());
});

/**
 * Parse incoming push event data safely.
 */
function parsePushData(data) {
  if (!data) return {};
  try {
    const text = data.text ? data.text() : data;
    if (typeof text === 'string') {
      return JSON.parse(text);
    }
    if (data.json) return data.json();
  } catch (_) {
    // ignore
  }
  return {};
}

self.addEventListener('push', (event) => {
  try {
    const payload = parsePushData(event.data);
    const title = payload.title || 'Handi';
    const body = payload.body || 'Tienes una nueva notificación';
    const icon = payload.icon || '/icons/icon-192.png';
    const badge = payload.badge || '/icons/badge-72.png';
    const url = payload.url || '/';
    // Stable tag for coalescing (thread or conversation)
    let tag = 'handi-notification';
    if (payload.tag) tag = payload.tag;
    else if (payload.threadId) tag = `thread:${payload.threadId}`;
    else if (payload.conversationId) tag = `thread:${payload.conversationId}`;
    else if (typeof url === 'string' && url) tag = `url:${url}`;
    const data = { url, tag, ts: Date.now(), threadId: payload.threadId, conversationId: payload.conversationId, ...payload.data };

    event.waitUntil(
      // @ts-ignore
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        data,
        renotify: true,
        requireInteraction: !!payload.requireInteraction,
        vibrate: payload.vibrate || [100, 50, 100],
        actions: Array.isArray(payload.actions) && payload.actions.length
          ? payload.actions
          : [{ action: 'open', title: 'Abrir', icon: icon }],
      })
    );
  } catch (err) {
    // noop
  }
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const dest = (n && n.data && n.data.url) ? n.data.url : '/';
  const action = event.action || 'open';
  event.notification.close();
  event.waitUntil((async () => {
    // @ts-ignore
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const cUrl = client.url || '';
        if (cUrl.includes(dest)) {
          // @ts-ignore
          await client.focus();
          return;
        }
      } catch (_) { /* ignore */ }
    }
    // @ts-ignore
    if (action === 'open') {
      await self.clients.openWindow(dest);
    }
  })());
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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ subscription: cur }),
      });
    } catch (_) {
      // ignore
    }
  })());
});
