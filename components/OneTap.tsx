"use client";

import * as React from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { toast } from "sonner";
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
  interface Window { google?: GoogleGlobal }
}

/**
 * Google One Tap (GIS) integration
 * - Loads GIS script on demand
 * - Prompts only when there is no Supabase session
 * - Exchanges Google ID token for a Supabase session via signInWithIdToken
 * - Positions the One Tap bubble top-right using a fixed container
 */
export default function OneTap() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const supabase = React.useMemo(() => createSupabaseBrowser<Database>(), []);

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const DISMISS_KEY = "one_tap_dismissed_until";

  const dismissedStillActive = React.useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      if (!v) return false;
      return Date.now() < Number(v);
    } catch {
      return false;
    }
  }, []);

  const setDismiss = React.useCallback((ms: number) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + ms));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
    if (!clientId || typeof window === "undefined") return;
    const debug = (process.env.NEXT_PUBLIC_ONE_TAP_DEBUG || "").trim() === "1";

    const loadGsiScript = () =>
      new Promise<void>((resolve) => {
        if (document.getElementById("google-identity-script")) return resolve();
        const s = document.createElement("script");
        s.id = "google-identity-script";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => resolve(); // fail-soft: just resolve to avoid blocking
        document.head.appendChild(s);
      });

    const randomString = (len = 32) => {
      try {
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        // Base64-url-ish without padding; keep alnum for safety
        return Array.from(bytes)
          .map((b) => (b % 36).toString(36))
          .join("")
          .slice(0, len);
      } catch {
        return Math.random().toString(36).slice(2, 2 + len);
      }
    };

    const initOneTap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || data.session) return; // already logged in

        if (!window.google?.accounts?.id) {
          await loadGsiScript();
        }

        if (!active || !window.google?.accounts?.id) return;

        const handleCredential = async (response: CredentialResponse) => {
          const token = response?.credential;
          if (!token) return;
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token,
            nonce,
          });
          if (!error) {
            try {
              window.google?.accounts?.id?.cancel?.();
              window.google?.accounts?.id?.disableAutoSelect?.();
              localStorage.removeItem(DISMISS_KEY);
            } catch {}
            try {
              window.location.reload();
            } catch {}
          } else {
            try {
              // Log and back off re-prompting
              // eslint-disable-next-line no-console
              console.error("OneTap signIn error", error);
              toast.error(
                "No se pudo iniciar sesión con Google One Tap. Intentando con Google.",
              );
              setDismiss(60 * 60 * 1000);
              // Fallback: intenta flujo OAuth clásico (redirige) si la config de One Tap falla
              const base = window.location.origin.replace(/\/$/, "");
              let nextPath = "/";
              try {
                const sp = new URLSearchParams(window.location.search);
                const n = sp.get("next");
                if (n && n.startsWith("/")) nextPath = n;
                const rt = localStorage.getItem("returnTo");
                if (rt && rt.startsWith("/")) nextPath = rt;
              } catch {}
              await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(nextPath)}` },
              });
            } catch {}
          }
        };

        const parentId = containerRef.current?.id || "gsi-container";
        const nonce = randomString(32);
        // Decide FedCM usage: allow env override; avoid on preview hosts where it's often not authorized
        const fedcmEnv = (process.env.NEXT_PUBLIC_GSI_USE_FEDCM || "auto").toLowerCase();
        let useFedcmForPrompt: boolean | undefined;
        if (fedcmEnv === "true" || fedcmEnv === "1") useFedcmForPrompt = true;
        else if (fedcmEnv === "false" || fedcmEnv === "0") useFedcmForPrompt = false;
        else {
          const host = window.location.hostname;
          const isPreviewHost = /\.vercel\.app$/i.test(host) || /\.netlify\.app$/i.test(host) || /\.onrender\.com$/i.test(host);
          // Disable FedCM by default on common preview hosts to avoid generic "Can't continue" errors
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
          nonce,
          // Prefer FedCM if available when enabled; otherwise use classic One Tap
          use_fedcm_for_prompt: useFedcmForPrompt,
        });

        // Show the One Tap prompt unless user dismissed recently
        if (!dismissedStillActive()) {
          window.google.accounts.id.prompt((notification?: PromptMomentNotification) => {
            try {
              if (!notification) return;
              if (debug) {
                const nd = notification.getNotDisplayedReason?.();
                const dd = notification.getDismissedReason?.();
                const sd = notification.getSkippedReason?.();
                // eslint-disable-next-line no-console
                console.debug("[OneTap] prompt notification", {
                  isDisplayed: notification.isDisplayed?.(),
                  isNotDisplayed: notification.isNotDisplayed?.(),
                  notDisplayedReason: nd,
                  isDismissed: notification.isDismissedMoment?.(),
                  dismissedReason: dd,
                  isSkipped: notification.isSkippedMoment?.(),
                  skippedReason: sd,
                  fedcm: useFedcmForPrompt,
                  host: typeof window !== "undefined" ? window.location.host : undefined,
                });
              }
              if (notification.isDismissedMoment?.() === true) {
                setDismiss(DAY);
              } else if (notification.isNotDisplayed?.() === true) {
                // Likely suppressed by user or blocked; back off a bit
                setDismiss(4 * HOUR);
              } else if (notification.isSkippedMoment?.() === true) {
                setDismiss(12 * HOUR);
              }
            } catch {
              // ignore
            }
          });
        }

        // Hide the prompt as soon as we get a session (e.g., via other login UI)
        const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
          if (session) {
            try {
              window.google?.accounts?.id?.cancel?.();
              window.google?.accounts?.id?.disableAutoSelect?.();
            } catch {}
          }
        });
        // expose unsubscribe for effect cleanup
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch (e) {
        try {
          // eslint-disable-next-line no-console
          console.error("OneTap exception", e);
          setDismiss(60 * 60 * 1000);
        } catch {}
      }
    };

    let unsubscribe: (() => void) | undefined;
    void initOneTap();
    return () => {
      active = false;
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {}
      try {
        unsubscribe?.();
      } catch {}
    };
  }, [supabase]);

  // Container that anchors the One Tap prompt in the top-right corner
  return (
    <div
      id="gsi-container"
      ref={containerRef}
      style={{ position: "fixed", top: 12, right: 12, zIndex: 60 }}
      aria-hidden
    />
  );
}
