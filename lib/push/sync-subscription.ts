"use client";

import ensurePushSubscription from "@/lib/push";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export type PushSyncSkipReason =
  | "unsupported"
  | "permission_not_granted"
  | "missing_public_key";

export type PushSyncFailReason =
  | "ensure_subscription_failed"
  | "invalid_subscription"
  | "backend_rejected"
  | "network_error";

export type PushSyncResult =
  | { ok: true; status: number }
  | { ok: false; skipped: true; reason: PushSyncSkipReason }
  | {
      ok: false;
      skipped?: false;
      reason: PushSyncFailReason;
      status?: number;
      error?: unknown;
    };

export function canUsePushSync(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  return "PushManager" in window;
}

export async function syncPushSubscription(
  publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "",
): Promise<PushSyncResult> {
  if (!canUsePushSync()) {
    return { ok: false, skipped: true, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, skipped: true, reason: "permission_not_granted" };
  }
  if (!publicKey) {
    return { ok: false, skipped: true, reason: "missing_public_key" };
  }

  try {
    const sub = await ensurePushSubscription(publicKey);
    if (!sub) {
      return { ok: false, reason: "invalid_subscription" };
    }

    const payload =
      typeof sub.toJSON === "function"
        ? sub.toJSON()
        : JSON.parse(JSON.stringify(sub));
    if (!payload?.endpoint || !payload?.keys?.p256dh || !payload?.keys?.auth) {
      return { ok: false, reason: "invalid_subscription" };
    }

    const userAgent = navigator.userAgent;
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;

    let response: Response;
    try {
      response = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: JSONH,
        body: JSON.stringify({ subscription: payload, userAgent, appVersion }),
      });
    } catch (error) {
      return { ok: false, reason: "network_error", error };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: "backend_rejected",
        status: response.status,
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      reason: "ensure_subscription_failed",
      error,
    };
  }
}
