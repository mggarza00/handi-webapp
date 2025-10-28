// lib/push.ts
// Utilities for Web Push subscription

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

/**
 * Ensure the Service Worker is registered and a PushSubscription exists.
 * Requests Notification permission if needed. Returns the active subscription.
 */
export async function ensurePushSubscription(publicKey: string): Promise<PushSubscription> {
  if (!publicKey || typeof publicKey !== 'string') throw new Error('VAPID public key requerida');
  if (typeof window === 'undefined') throw new Error('Solo disponible en el navegador');
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker no soportado');
  if (!('Notification' in window)) throw new Error('Notification API no soportada');

  // Permission gate
  let permission: NotificationPermission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') throw new Error('Permiso de notificaciones no concedido');

  // Register or reuse SW
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  const reg = existing || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready; // ensure active

  // Existing subscription?
  const current = await reg.pushManager.getSubscription();
  if (current) return current;

  // Subscribe with provided VAPID public key
  const raw = urlBase64ToUint8Array(publicKey);
  // Rewrap via number[] to ensure DOM lib narrows to the non-generic Uint8Array type
  const applicationServerKey = new Uint8Array(Array.from(raw));
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  return subscription;
}

export default ensurePushSubscription;
