"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { syncPushSubscription } from "@/lib/push/sync-subscription";

const logPushError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[EnableNotificationsButton]", error);
  }
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    const ua = navigator.userAgent || navigator.vendor || "";
    const iOSUA = /iPad|iPhone|iPod/i.test(ua);
    const iPadOS =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
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

export default function EnableNotificationsButton({
  publicKey,
  className,
  labelEnable = "Activar notificaciones",
  labelEnabled = "Notificaciones activas",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);

  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window,
    [],
  );
  const isiOS = useMemo(() => isIOS(), []);

  useEffect(() => {
    setMounted(true);
    if (!supported) return;
    try {
      setPerm(Notification.permission);
    } catch (error) {
      logPushError(error);
      setPerm(null);
    }
  }, [supported]);

  // Persist enabled state across reloads by checking existing subscription
  useEffect(() => {
    if (!mounted || !supported) return;
    (async () => {
      try {
        const existingReg =
          await navigator.serviceWorker.getRegistration("/sw.js");
        const reg = existingReg || (await navigator.serviceWorker.ready);
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setEnabled(Boolean(sub));
      } catch (error) {
        logPushError(error);
      }
    })();
  }, [mounted, supported]);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      if (!supported) {
        throw new Error("Este navegador no soporta notificaciones push");
      }
      if (!publicKey) {
        throw new Error("Falta la clave publica VAPID");
      }

      const result = await syncPushSubscription(publicKey);
      if (!result.ok) {
        if (result.skipped && result.reason === "permission_not_granted") {
          throw new Error("Permiso de notificaciones no concedido");
        }
        if (
          !result.skipped &&
          result.reason === "backend_rejected" &&
          result.status === 401
        ) {
          throw new Error("Inicia sesion para activar notificaciones");
        }
        throw new Error("No se pudo guardar la suscripcion");
      }
      setEnabled(true);
    } catch (err) {
      setError((err as Error).message || "Error al activar notificaciones");
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  if (!supported) {
    return isiOS ? (
      <p className="text-xs text-neutral-600">
        Tu navegador en iOS no soporta notificaciones push. Usa iOS 16.4+ con
        Safari y habilitalas desde el candado de la barra de direcciones.
      </p>
    ) : null;
  }

  if (perm === "denied") {
    return (
      <p className="text-xs text-neutral-600">
        {isiOS
          ? "Notificaciones bloqueadas en iOS. Habilitalas desde el candado junto a la barra de direcciones o en Ajustes > Safari > Notificaciones."
          : "Notificaciones bloqueadas por el navegador. Habilitalas desde el candado de la barra de direcciones."}
      </p>
    );
  }

  return (
    <div className={className}>
      <Button onClick={onClick} disabled={loading || enabled}>
        {enabled ? labelEnabled : labelEnable}
      </Button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
