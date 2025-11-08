"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import safeIsSafariOniOS, { isIOS164OrLater } from "@/lib/pwa/install-detect";

const LS_KEYS = {
  SEEN_TOAST: "handi_notif_seen_toast_v1",
  DISMISSED_DENIED_HELP: "handi_notif_dismissed_denied_help_v1",
} as const;

export default function RequestNotificationsToast() {
  type NotifState = "hidden" | "ask" | "denied";
  const [ui, setUI] = useState<NotifState>("hidden");
  const [isIOS, setIsIOS] = useState(false);

  const canUseNotifications = useMemo(
    () => typeof window !== "undefined" && "Notification" in window,
    [],
  );

  useEffect(() => {
    // Detect platform once (safe on SSR)
    try { setIsIOS(safeIsSafariOniOS()); } catch { setIsIOS(false); }
  }, []);

  useEffect(() => {
    if (!canUseNotifications) return;
    // Solo en cliente
    let mounted = true;
    try {
      const seen = ((): boolean => { try { return localStorage.getItem(LS_KEYS.SEEN_TOAST) === "1"; } catch { return false; } })();
      const status = (window as any).Notification?.permission as NotificationPermission ?? "default";
      if (!mounted) return;
      if (status === "default" && !seen) setUI("ask");
      else if (status === "denied") {
        const dismissed = localStorage.getItem(LS_KEYS.DISMISSED_DENIED_HELP) === "1";
        if (!dismissed) setUI("denied");
      }
    } catch { /* ignore */ }

    const onEvent = () => { void onGrant(); };
    window.addEventListener("handi:push:subscribe", onEvent);
    return () => {
      mounted = false;
      window.removeEventListener("handi:push:subscribe", onEvent);
    };
  }, [canUseNotifications]);

  async function onGrant() {
    setUI("hidden");
    try {
      const mod = await import("@/lib/push");
      const ensurePushSubscription = (mod as any).default || (mod as any).ensurePushSubscription;
      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
      if (!publicKey || typeof ensurePushSubscription !== "function") return;
      const sub = await ensurePushSubscription(publicKey);
      const payload = (sub as any)?.toJSON?.() ?? JSON.parse(JSON.stringify(sub));
      const userAgent = navigator.userAgent;
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ subscription: payload, userAgent, appVersion }),
      });
    } catch { /* ignore */ }
  }

  const requestPerm = useCallback(async () => {
    if (!canUseNotifications) return setUI("hidden");
    try {
      const res = await (window as any).Notification.requestPermission();
      try { localStorage.setItem(LS_KEYS.SEEN_TOAST, "1"); } catch { /* ignore */ }
      if (res === "granted") {
        setUI("hidden");
        try { window.dispatchEvent(new Event("handi:push:subscribe")); } catch { /* ignore */ }
      }
      else if (res === "denied") setUI("denied");
      else setUI("hidden");
    } catch { setUI("hidden"); }
  }, [canUseNotifications]);

  const dismissAsk = useCallback(() => {
    try { localStorage.setItem(LS_KEYS.SEEN_TOAST, "1"); } catch { /* ignore */ }
    setUI("hidden");
  }, []);
  function dismissDeniedHelp() {
    try { localStorage.setItem(LS_KEYS.DISMISSED_DENIED_HELP, "1"); } catch { /* ignore */ }
    setUI("hidden");
  }

  if (!canUseNotifications || ui === "hidden") return null;

  const iosPushCapable = isIOS && isIOS164OrLater();
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-x-0 bottom-20 mx-auto w-95% max-w-md rounded-2xl shadow-lg border bg-white p-4 z-50">
      {children}
    </div>
  );

  if (ui === "ask") {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Permitir notificaciones</p>
            <p className="mt-1 text-xs text-neutral-600">
              Activa las notificaciones para recibir mensajes de trabajos, estatus y pagos en tiempo real.
            </p>
          </div>
          <button
            aria-label="Cerrar"
            onClick={dismissAsk}
            className="ml-2 text-neutral-500 hover:text-neutral-800"
          >
            ×
          </button>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-xl border"
            onClick={dismissAsk}
          >
            Ahora no
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-xl bg-black text-white"
            onClick={requestPerm}
          >
            Permitir
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="text-sm font-semibold">Activa las notificaciones</div>
      <p className="text-xs mt-1">
        {isIOS
          ? "En iPhone/iPad ve a Ajustes > Notificaciones > Handi y activa 'Permitir notificaciones'."
          : "En tu dispositivo, ve a Ajustes > Notificaciones > Handi y activa 'Permitir notificaciones'."}
      </p>
      <ul className="text-xs mt-2 list-disc pl-5 space-y-1">
        {isIOS ? (
          <>
            <li>Asegúrate de haber instalado Handi en la pantalla de inicio (PWA).</li>
            <li>Abre Ajustes &gt; Notificaciones &gt; Handi.</li>
            <li>Activa Permitir notificaciones.</li>
          </>
        ) : (
          <>
            <li>Busca Notificaciones o Apps en Ajustes.</li>
            <li>Selecciona Handi (app instalada) o el navegador si usas la web.</li>
            <li>Activa Permitir notificaciones.</li>
          </>
        )}
      </ul>
      <div className="mt-3 flex gap-2 justify-end">
        <button className="px-3 py-1.5 text-sm rounded-xl border" onClick={dismissDeniedHelp}>
          Listo
        </button>
      </div>
    </Card>
  );
}
