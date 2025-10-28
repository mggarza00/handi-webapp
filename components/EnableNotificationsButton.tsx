"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPublicVapidKey, subscribePush } from "@/lib/web-push-client";

type Props = {
  className?: string;
  labelEnable?: string;
  labelEnabled?: string;
};

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export function EnableNotificationsButton({ className, labelEnable = "Activar notificaciones", labelEnabled = "Notificaciones activadas" }: Props) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(() => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator, []);
  const publicKey = getPublicVapidKey();

  const onClick = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (!supported) throw new Error('Este navegador no soporta notificaciones push');
      if (!publicKey) throw new Error('Falta la clave pública VAPID (NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)');

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        throw new Error('Permiso de notificaciones denegado');
      }

      const subscription = await subscribePush();
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      // Prefer using app version from env or package, but allow override via props later
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;

      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: JSONH,
        body: JSON.stringify({ subscription, userAgent, appVersion }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'No se pudo guardar la suscripción');
      }
      setEnabled(true);
    } catch (err) {
      setError((err as Error).message || 'Error al activar notificaciones');
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [supported, publicKey]);

  if (!supported) return null;

  return (
    <div className={className}>
      <Button onClick={onClick} disabled={loading || enabled || !publicKey}>
        {enabled ? labelEnabled : labelEnable}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

export default EnableNotificationsButton;

