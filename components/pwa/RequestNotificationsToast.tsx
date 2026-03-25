"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ensurePushSubscription from "@/lib/push";
import {
  isStandalonePWA,
  notificationsSupported,
} from "@/lib/pwa/install-detect";

const SESSION_DISMISS_KEY = "handi_notif_dismissed_session_v1";

type NotifState = "hidden" | "ask";

export default function RequestNotificationsToast() {
  const [ui, setUI] = useState<NotifState>("hidden");

  const logToastError = useCallback((error: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[RequestNotificationsToast]", error);
    }
  }, []);

  const canUseNotifications = useMemo(() => notificationsSupported(), []);
  const isStandalone = useMemo(() => isStandalonePWA(), []);

  useEffect(() => {
    if (!canUseNotifications || !isStandalone) return;

    try {
      const dismissedThisSession =
        sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
      const status =
        typeof window !== "undefined" && "Notification" in window
          ? window.Notification.permission
          : "default";

      if (dismissedThisSession) return;
      if (status === "default") setUI("ask");
      else setUI("hidden");
    } catch (error) {
      logToastError(error);
      setUI("hidden");
    }
  }, [canUseNotifications, isStandalone, logToastError]);

  const onGrant = useCallback(async () => {
    setUI("hidden");
    try {
      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
      if (!publicKey) return;
      const sub = await ensurePushSubscription(publicKey);
      if (!sub) return;
      const payload = typeof sub.toJSON === "function" ? sub.toJSON() : sub;
      const userAgent = navigator.userAgent;
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ subscription: payload, userAgent, appVersion }),
      });
      try {
        window.dispatchEvent(new Event("handi:push:subscribe"));
      } catch (error) {
        logToastError(error);
      }
    } catch (error) {
      logToastError(error);
    }
  }, [logToastError]);

  const requestPerm = useCallback(async () => {
    if (!canUseNotifications || !isStandalone) {
      setUI("hidden");
      return;
    }

    try {
      const res =
        typeof window !== "undefined" && "Notification" in window
          ? await window.Notification.requestPermission()
          : "default";

      if (res === "granted") {
        await onGrant();
      } else {
        setUI("hidden");
      }
    } catch (error) {
      logToastError(error);
      setUI("hidden");
    }
  }, [canUseNotifications, isStandalone, logToastError, onGrant]);

  const dismissAsk = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch (error) {
      logToastError(error);
    }
    setUI("hidden");
  }, [logToastError]);

  if (!canUseNotifications || !isStandalone || ui === "hidden") return null;

  const Card = ({ children }: { children: ReactNode }) => (
    <div className="fixed inset-x-0 top-[72px] md:top-[84px] mx-auto w-[95%] max-w-md rounded-2xl shadow-lg border border-white/15 bg-neutral-900/80 backdrop-blur-md p-4 z-[60] text-white">
      {children}
    </div>
  );

  return (
    <Card>
      <div className="text-sm font-semibold">Permitir notificaciones</div>
      <p className="text-xs mt-1">
        Activa las notificaciones para recibir mensajes de trabajos, estatus y
        pagos en tiempo real.
      </p>
      <div className="mt-3 flex gap-2 justify-end">
        <button
          className="px-3 py-1.5 text-sm rounded-xl bg-black text-white"
          onClick={dismissAsk}
        >
          Más tarde
        </button>
        <button
          className="px-3 py-1.5 text-sm rounded-xl bg-white text-black"
          onClick={requestPerm}
        >
          Permitir
        </button>
      </div>
    </Card>
  );
}
