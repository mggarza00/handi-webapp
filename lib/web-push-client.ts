// Client-side helpers for Web Push subscription
import { urlBase64ToUint8Array } from "./push";

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
  const raw = urlBase64ToUint8Array(vapid);
  const applicationServerKey = new Uint8Array(Array.from(raw));
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  return sub;
}
