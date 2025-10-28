"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import ensurePushSubscription from "@/lib/push";

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  try {
    const ua = navigator.userAgent || navigator.vendor || "";
    const iOSUA = /iPad|iPhone|iPod/i.test(ua);
    const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    return iOSUA || iPadOS;
  } catch {
    return false;
  }
}

type Props = {
  publicKey: string;
  className?: string;
  labelEnable?: string;
  labelEnabled?: string;
};

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export default function EnableNotificationsButton({ publicKey, className, labelEnable = "Activar notificaciones", labelEnabled = "Notificaciones activas" }: Props) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);

  const supported = useMemo(() => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window, []);
  const isiOS = useMemo(() => isIOS(), []);

  useEffect(() => {
    if (!supported) return;
    try {
      setPerm(Notification.permission);
    } catch {
      setPerm(null);
    }
  }, [supported]);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      if (!supported) throw new Error('Este navegador no soporta notificaciones push');
      if (!publicKey) throw new Error('Falta la clave pública VAPID');

      const sub = await ensurePushSubscription(publicKey);
      const payload = (sub as any)?.toJSON?.() ?? JSON.parse(JSON.stringify(sub));
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;

      const res = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: JSONH,
        body: JSON.stringify({ subscription: payload, userAgent, appVersion }),
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
  }

  if (!supported) {
    // Mostrar tip en iOS cuando no hay soporte (otras plataformas: ocultar)
    return isiOS ? (
      <p className="text-xs text-neutral-600">
        Tu navegador en iOS no soporta notificaciones push. Usa iOS 16.4+ con Safari y habilítalas desde el candado de la barra de direcciones.
      </p>
    ) : null;
  }

  if (perm === 'denied') {
    return (
      <p className="text-xs text-neutral-600">
        {isiOS
          ? 'Notificaciones bloqueadas en iOS. Habilítalas desde el candado junto a la barra de direcciones o en Ajustes > Safari > Notificaciones.'
          : 'Notificaciones bloqueadas por el navegador. Habilítalas desde el candado de la barra de direcciones.'}
      </p>
    );
  }

  return (
    <div className={className}>
      <Button onClick={onClick} disabled={loading || enabled}>
        {enabled ? labelEnabled : labelEnable}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
