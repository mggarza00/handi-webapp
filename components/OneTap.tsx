"use client";

import * as React from "react";
import { toast } from "sonner";
import type { AuthError } from "@supabase/supabase-js";

import { createSupabaseBrowser } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type CredentialResponse = { credential?: string };
type PromptMomentNotification = {
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  getNotDisplayedReason?: () => string;
  isSkippedMoment: () => boolean;
  getSkippedReason?: () => string;
  isDismissedMoment: () => boolean;
  getDismissedReason?: () => string;
};
type GoogleId = {
  initialize: (options: Record<string, unknown>) => void;
  prompt: (cb?: (notification: PromptMomentNotification) => void) => void;
  cancel?: () => void;
  disableAutoSelect?: () => void;
};
type GoogleGlobal = { accounts?: { id?: GoogleId } };
declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DISMISS_KEY = "one_tap_dismissed_until";

const isDebug = () => process.env.NODE_ENV !== "production";

const devLog = (message: string, data?: unknown) => {
  if (!isDebug()) return;
  // eslint-disable-next-line no-console
  console.debug(`[OneTap] ${message}`, data ?? "");
};

const normalizeAuthError = (
  error: unknown,
): {
  message: string;
  status?: number;
  code?: string;
  name?: string;
} => {
  const e = error as
    | (Partial<AuthError> & { status?: number; code?: string })
    | undefined;
  return {
    message: (e?.message || "").toString(),
    status: typeof e?.status === "number" ? e.status : undefined,
    code: typeof e?.code === "string" ? e.code : undefined,
    name: typeof e?.name === "string" ? e.name : undefined,
  };
};

const isLikelyNonceError = (error: unknown) => {
  const n = normalizeAuthError(error);
  const text = `${n.message} ${n.code ?? ""}`.toLowerCase();
  return text.includes("nonce");
};

const shouldFallbackToOAuth = (error: unknown) => {
  const n = normalizeAuthError(error);
  const text = `${n.message} ${n.code ?? ""}`.toLowerCase();
  if (n.status && [400, 401, 403, 422].includes(n.status)) return true;
  if (text.includes("invalid_grant")) return true;
  if (text.includes("provider")) return true;
  if (text.includes("audience")) return true;
  if (text.includes("jwt")) return true;
  if (text.includes("token")) return true;
  return false;
};

/**
 * Google One Tap (GIS):
 * - mounted only on "/"
 * - initializes only when user has no active session
 * - signs in with ID token in Supabase
 */
export default function OneTap() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const supabase = React.useMemo(() => createSupabaseBrowser<Database>(), []);
  const nonceRef = React.useRef<string | null>(null);
  const handlingCredentialRef = React.useRef(false);
  const lastCredentialRef = React.useRef<string | null>(null);
  const oauthFallbackTriggeredRef = React.useRef(false);
  const toastShownRef = React.useRef(false);

  const dismissedStillActive = React.useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const value = localStorage.getItem(DISMISS_KEY);
      if (!value) return false;
      return Date.now() < Number(value);
    } catch (error) {
      devLog("dismiss read failed", error);
      return false;
    }
  }, []);

  const setDismiss = React.useCallback((ms: number) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + ms));
    } catch (error) {
      devLog("dismiss write failed", error);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
    if (!clientId || typeof window === "undefined") return;

    if (
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData
    ) {
      devLog("saveData enabled, skipping One Tap init");
      return;
    }

    const loadGsiScript = () =>
      new Promise<void>((resolve) => {
        if (document.getElementById("google-identity-script")) return resolve();
        const script = document.createElement("script");
        script.id = "google-identity-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });

    const randomString = (len = 32) => {
      try {
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map((b) => (b % 36).toString(36))
          .join("")
          .slice(0, len);
      } catch {
        return Math.random()
          .toString(36)
          .slice(2, 2 + len);
      }
    };

    const cancelPrompt = () => {
      try {
        window.google?.accounts?.id?.cancel?.();
        window.google?.accounts?.id?.disableAutoSelect?.();
      } catch (error) {
        devLog("cancel prompt failed", error);
      }
    };

    const hasSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        return Boolean(data.session);
      } catch (error) {
        devLog("getSession failed", error);
        return false;
      }
    };

    const handleCredential = async (response: CredentialResponse) => {
      const token = response?.credential;
      if (!active || !token) return;
      if (handlingCredentialRef.current) {
        devLog("credential callback skipped because sign-in is in progress");
        return;
      }
      if (lastCredentialRef.current === token) {
        devLog("duplicate credential callback skipped");
        return;
      }

      handlingCredentialRef.current = true;
      lastCredentialRef.current = token;

      try {
        const nonce = nonceRef.current ?? undefined;
        let { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token,
          nonce,
        });

        // If nonce validation fails in some browsers/flows, retry once without nonce.
        if (error && nonce && isLikelyNonceError(error)) {
          devLog(
            "retrying signInWithIdToken without nonce",
            normalizeAuthError(error),
          );
          const retry = await supabase.auth.signInWithIdToken({
            provider: "google",
            token,
          });
          error = retry.error;
        }

        const sessionNow = await hasSession();
        if (!error || sessionNow) {
          cancelPrompt();
          try {
            localStorage.removeItem(DISMISS_KEY);
          } catch {
            // ignore
          }
          devLog("One Tap sign-in completed", {
            fromErrorPath: Boolean(error),
          });
          return;
        }

        const normalized = normalizeAuthError(error);
        devLog("signInWithIdToken failed", normalized);

        if (shouldFallbackToOAuth(error)) {
          if (oauthFallbackTriggeredRef.current) return;
          oauthFallbackTriggeredRef.current = true;
          setDismiss(HOUR);

          const base = window.location.origin.replace(/\/$/, "");
          let nextPath = "/";
          try {
            const params = new URLSearchParams(window.location.search);
            const next = params.get("next");
            if (next && next.startsWith("/")) nextPath = next;
            const returnTo = localStorage.getItem("returnTo");
            if (returnTo && returnTo.startsWith("/")) nextPath = returnTo;
          } catch (readError) {
            devLog("could not read next path", readError);
          }

          toast.error(
            "No se pudo iniciar sesion con Google One Tap. Redirigiendo a Google...",
          );
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${base}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          });
          return;
        }

        setDismiss(4 * HOUR);
        if (!toastShownRef.current) {
          toastShownRef.current = true;
          toast.error("No se pudo iniciar sesion con Google One Tap.");
          window.setTimeout(() => {
            toastShownRef.current = false;
          }, 3000);
        }
      } catch (error) {
        devLog("unexpected credential handler error", error);
      } finally {
        handlingCredentialRef.current = false;
      }
    };

    const initOneTap = async () => {
      const sessionExists = await hasSession();
      if (!active || sessionExists) {
        cancelPrompt();
        return;
      }

      if (!window.google?.accounts?.id) {
        await loadGsiScript();
      }
      if (!active || !window.google?.accounts?.id) return;

      const parentId = containerRef.current?.id || "gsi-container";
      nonceRef.current = randomString(32);

      const fedcmEnv = (
        process.env.NEXT_PUBLIC_GSI_USE_FEDCM || "auto"
      ).toLowerCase();
      let useFedcmForPrompt: boolean | undefined;
      if (fedcmEnv === "true" || fedcmEnv === "1") useFedcmForPrompt = true;
      else if (fedcmEnv === "false" || fedcmEnv === "0")
        useFedcmForPrompt = false;
      else {
        const host = window.location.hostname;
        const isPreviewHost =
          /\.vercel\.app$/i.test(host) ||
          /\.netlify\.app$/i.test(host) ||
          /\.onrender\.com$/i.test(host);
        useFedcmForPrompt = !isPreviewHost;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: false,
        itp_support: true,
        prompt_parent_id: parentId,
        context: "signin",
        nonce: nonceRef.current,
        use_fedcm_for_prompt: useFedcmForPrompt,
      });

      if (!dismissedStillActive()) {
        window.google.accounts.id.prompt(
          (notification?: PromptMomentNotification) => {
            if (!notification) return;
            if (isDebug()) {
              devLog("prompt notification", {
                isDisplayed: notification.isDisplayed?.(),
                isNotDisplayed: notification.isNotDisplayed?.(),
                notDisplayedReason: notification.getNotDisplayedReason?.(),
                isDismissed: notification.isDismissedMoment?.(),
                dismissedReason: notification.getDismissedReason?.(),
                isSkipped: notification.isSkippedMoment?.(),
                skippedReason: notification.getSkippedReason?.(),
                fedcm: useFedcmForPrompt,
                host: window.location.host,
              });
            }
            if (notification.isDismissedMoment?.() === true) {
              setDismiss(DAY);
            } else if (notification.isNotDisplayed?.() === true) {
              setDismiss(4 * HOUR);
            } else if (notification.isSkippedMoment?.() === true) {
              setDismiss(12 * HOUR);
            }
          },
        );
      }

      const { data: listener } = supabase.auth.onAuthStateChange(
        (_, session) => {
          if (!session) return;
          cancelPrompt();
        },
      );
      unsubscribe = () => listener.subscription.unsubscribe();
    };

    void initOneTap();
    return () => {
      active = false;
      cancelPrompt();
      try {
        unsubscribe?.();
      } catch (error) {
        devLog("unsubscribe failed", error);
      }
    };
  }, [dismissedStillActive, setDismiss, supabase]);

  return (
    <div
      id="gsi-container"
      ref={containerRef}
      style={{ position: "fixed", top: 12, right: 12, zIndex: 60 }}
      aria-hidden
    />
  );
}
