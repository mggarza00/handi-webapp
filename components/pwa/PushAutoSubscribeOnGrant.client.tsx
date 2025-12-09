"use client";

import { useEffect } from "react";

import ensurePushSubscription from "@/lib/push";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const logPushAutoSubscribeError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[PushAutoSubscribeOnGrant]", error);
  }
};

export function PushAutoSubscribeOnGrant() {
  useEffect(() => {
    const handler = async () => {
      try {
        if (typeof window === "undefined") return;
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
        if (Notification.permission !== "granted") return;

        const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
        if (!publicKey) return;

        const sub = await ensurePushSubscription(publicKey);
        const payload =
          typeof sub?.toJSON === "function" ? sub.toJSON() : JSON.parse(JSON.stringify(sub ?? {}));
        const userAgent = navigator.userAgent;
        const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: JSONH,
          body: JSON.stringify({ subscription: payload, userAgent, appVersion }),
        }).catch(() => {});
      } catch (error) {
        logPushAutoSubscribeError(error);
      }
    };

    window.addEventListener("handi:push:subscribe", handler as EventListener);
    return () => window.removeEventListener("handi:push:subscribe", handler as EventListener);
  }, []);
  return null;
}

export default PushAutoSubscribeOnGrant;
