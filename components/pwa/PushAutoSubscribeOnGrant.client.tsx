"use client";

import { useCallback, useEffect, useRef } from "react";

import { syncPushSubscription } from "@/lib/push/sync-subscription";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const logPushAutoSubscribeError = (error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error("[PushAutoSubscribeOnGrant]", error);
  }
};

const logPushAutoSubscribeInfo = (message: string, detail?: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[PushAutoSubscribeOnGrant]", message, detail ?? "");
  }
};

export function PushAutoSubscribeOnGrant() {
  const hasSyncedRef = useRef(false);
  const inFlightRef = useRef(false);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (!retryTimerRef.current) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const scheduleRetry = useCallback((trigger: () => void) => {
    const retryDelaysMs = [1200, 4000, 10000];
    if (retryAttemptRef.current >= retryDelaysMs.length) return;
    if (retryTimerRef.current) return;

    const delay = retryDelaysMs[retryAttemptRef.current];
    retryAttemptRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      trigger();
    }, delay);
  }, []);

  const runSync = useCallback(
    async (force = false) => {
      if (force) {
        hasSyncedRef.current = false;
      }
      if (inFlightRef.current || hasSyncedRef.current) return;

      try {
        inFlightRef.current = true;
        const result = await syncPushSubscription();

        if (result.ok) {
          hasSyncedRef.current = true;
          retryAttemptRef.current = 0;
          clearRetryTimer();
          logPushAutoSubscribeInfo("push sync successful");
          return;
        }

        if (result.skipped) {
          logPushAutoSubscribeInfo("push sync skipped", result.reason);
          if (result.reason === "permission_not_granted") {
            clearRetryTimer();
            retryAttemptRef.current = 0;
          }
          return;
        }

        // 401/403 are expected when session is not ready yet; retry with backoff.
        if (
          result.reason === "backend_rejected" &&
          (result.status === 401 || result.status === 403)
        ) {
          logPushAutoSubscribeInfo(
            "push sync waiting for auth session",
            result,
          );
          scheduleRetry(() => {
            void runSync();
          });
          return;
        }

        if (
          result.reason === "network_error" ||
          result.reason === "backend_rejected" ||
          result.reason === "ensure_subscription_failed"
        ) {
          logPushAutoSubscribeInfo(
            "push sync failed, scheduling retry",
            result,
          );
          scheduleRetry(() => {
            void runSync();
          });
        }
      } catch (error) {
        logPushAutoSubscribeError(error);
      } finally {
        inFlightRef.current = false;
      }
    },
    [clearRetryTimer, scheduleRetry],
  );

  useEffect(() => {
    void runSync();

    const supabase = createSupabaseBrowser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      retryAttemptRef.current = 0;
      clearRetryTimer();
      void runSync(true);
    });

    const handlePushSyncRequested = () => {
      retryAttemptRef.current = 0;
      clearRetryTimer();
      void runSync(true);
    };

    const handleOnline = () => {
      void runSync();
    };

    window.addEventListener("handi:push:subscribe", handlePushSyncRequested);
    window.addEventListener("online", handleOnline);

    return () => {
      listener.subscription.unsubscribe();
      clearRetryTimer();
      window.removeEventListener(
        "handi:push:subscribe",
        handlePushSyncRequested,
      );
      window.removeEventListener("online", handleOnline);
    };
  }, [clearRetryTimer, runSync]);

  return null;
}

export default PushAutoSubscribeOnGrant;
