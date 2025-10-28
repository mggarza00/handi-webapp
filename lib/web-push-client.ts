// Client-side helpers for Web Push subscription

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getPublicVapidKey(): string | null {
  const k = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  return (typeof k === 'string' && k.length) ? k : null;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === 'undefined') throw new Error('SW only available in browser');
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
  // Ensure single registration
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existing) return existing;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready; // ensure active
  return reg;
}

export async function subscribePush(): Promise<PushSubscription> {
  const reg = await registerServiceWorker();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  const vapid = getPublicVapidKey();
  if (!vapid) throw new Error('Missing public VAPID key');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  });
  return sub;
}

