/* eslint-disable no-restricted-globals */
// Handi Web Push Service Worker
// Listens for push events and displays notifications.

// ---- ConfiguraciÃ³n offline y utilidades ----
const DEBUG = (() => {
  try {
    const host = self.location?.hostname || "";
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch (_) {
    return false;
  }
})();
function log(...args) {
  if (DEBUG) {
    try {
      console.log("SW", ...args);
    } catch (_) {}
  }
}
function logError(...args) {
  if (DEBUG) {
    try {
      console.error("SW", ...args);
    } catch (_) {}
  }
}
const CACHE_VERSION = "handi-v1";
const DEFAULT_NOTIFICATION_ICON = "/icons/icon-192.png";
const DEFAULT_NOTIFICATION_BADGE = "/icons/badge-72.png";
const PRECACHE = [
  "/", // start_url
  "/offline.html",
  "/manifest.webmanifest",
  DEFAULT_NOTIFICATION_ICON,
  "/icons/icon-512.png",
  "/icons/maskable_icon.png",
  DEFAULT_NOTIFICATION_BADGE,
  "/images/handifav_fondo.png",
  "/images/handifav_sinfondo.png",
].filter(Boolean);

self.addEventListener("install", (event) => {
  // Precache mÃ­nimo: start_url, manifest e Ã­conos
  log("install");
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}),
  );
  // @ts-ignore
  self.skipWaiting?.();
});

self.addEventListener("activate", (event) => {
  // Limpia caches antiguos y toma control
  log("activate");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => (k !== CACHE_VERSION ? caches.delete(k) : undefined)),
        ),
      )
      // @ts-ignore
      .then(() => self.clients.claim()),
  );
});

// Estrategia: Network-first para GET same-origin; fallback a cachÃ© y a /offline.html si falla.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Log bÃ¡sico en DEBUG para diagnÃ³sticos sin ruido
  if (DEBUG && req.mode === "navigate") log("fetch navigate", url.pathname);
  // Only handle GET
  if (req.method !== "GET") return;
  // Only same-origin
  if (url.origin !== self.location.origin) return;
  // Avoid API or special backends
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/supabase/"))
    return;

  // Nota: se usa Accept para detectar HTML; no se requiere isNavigate

  // Network first with fallback
  event.respondWith(
    (async () => {
      try {
        // Intento red
        const netRes = await fetch(req);
        // Cachea en segundo plano si es 200 y bÃ¡sico
        if (
          netRes &&
          netRes.status === 200 &&
          netRes.type === "basic" &&
          PRECACHE.includes(url.pathname)
        ) {
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
        if (req.headers.get("accept")?.includes("text/html")) {
          const off = await caches.match("/offline.html");
          if (off) return off;
          return new Response(
            "<!doctype html><title>Sin conexiÃ³n</title><h1>Sin conexiÃ³n</h1>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
        // Ãšltimo recurso: a falta de todo, una respuesta vacÃ­a con 503
        return new Response("", { status: 503, statusText: "Offline" });
      }
    })(),
  );
});

// (parsePushData eliminado: no se usa; usamos event.data?.json?.())

self.addEventListener("push", (event) => {
  try {
    log("push");
    let data = {};
    try {
      // eslint-disable-next-line no-unused-expressions
      data = event.data?.json?.() ?? {};
    } catch (error) {
      logError("push payload parse failed", error);
    }
    const payloadData =
      data && typeof data.data === "object" && data.data ? data.data : {};
    const strOrNull = (value) =>
      typeof value === "string" && value.trim() ? value.trim() : null;
    const mergedData = {
      ...payloadData,
      url: payloadData.url || data.url || "/",
    };
    const icon =
      strOrNull(data?.icon) ||
      strOrNull(payloadData?.icon) ||
      DEFAULT_NOTIFICATION_ICON;
    const badge =
      strOrNull(data?.badge) ||
      strOrNull(payloadData?.badge) ||
      DEFAULT_NOTIFICATION_BADGE;
    const image =
      strOrNull(data?.image) || strOrNull(payloadData?.image) || undefined;
    const title = strOrNull(data?.title) || "Handi";
    const options = {
      body: strOrNull(data?.body) || "",
      icon,
      badge,
      image,
      data: mergedData,
      tag: strOrNull(data?.tag) || strOrNull(payloadData?.tag) || "handi",
      renotify:
        typeof data?.renotify === "boolean"
          ? data.renotify
          : typeof payloadData?.renotify === "boolean"
            ? payloadData.renotify
            : false,
      requireInteraction:
        typeof data?.requireInteraction === "boolean"
          ? data.requireInteraction
          : typeof payloadData?.requireInteraction === "boolean"
            ? payloadData.requireInteraction
            : false,
      vibrate:
        Array.isArray(data?.vibrate) && data.vibrate.length > 0
          ? data.vibrate
          : Array.isArray(payloadData?.vibrate) &&
              payloadData.vibrate.length > 0
            ? payloadData.vibrate
            : undefined,
      actions:
        Array.isArray(data?.actions) && data.actions.length > 0
          ? data.actions
          : Array.isArray(payloadData?.actions) &&
              payloadData.actions.length > 0
            ? payloadData.actions
            : undefined,
    };

    // @ts-ignore
    event.waitUntil(
      self.registration.showNotification(title, options).catch((error) => {
        logError("showNotification failed", error);
      }),
    );
  } catch (err) {
    logError("push event failed", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  log("notificationclick");
  event.notification.close();
  const url =
    event.notification && event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";
  event.waitUntil(
    // @ts-ignore
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          try {
            const cUrl = client && client.url ? client.url : "";
            // @ts-ignore
            if (cUrl === url && "focus" in client && client.focus) {
              // @ts-ignore
              return client.focus();
            }
          } catch (error) {
            logError("notificationclick focus failed", error);
          }
        }
        // @ts-ignore
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return undefined;
      })
      .catch((error) => {
        logError("notificationclick handler failed", error);
      }),
  );
});

// Attempt to auto-resubscribe on key rotation
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        // @ts-ignore
        const reg = await self.registration;
        const cur = await reg.pushManager.getSubscription();
        if (!cur) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ subscription: cur }),
        });
      } catch (_) {
        // ignore
      }
    })(),
  );
});

// ComunicaciÃ³n con la pÃ¡gina para coordinar actualizaciones
self.addEventListener("message", (event) => {
  // Permitir string directo o objeto { type }
  const raw = event?.data;
  const type = typeof raw === "string" ? raw : raw && raw.type;
  if (type === "SKIP_WAITING") {
    log("SKIP_WAITING recibido");
    // @ts-ignore
    self.skipWaiting?.();
  }
});
