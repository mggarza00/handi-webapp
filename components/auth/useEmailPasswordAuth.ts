"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowser } from "@/lib/supabase/client";

export type EmailAuthMode = "login" | "signup";

type UseEmailPasswordAuthArgs = {
  next: string;
  onAuthSuccess?: () => void;
};

type AuthResult =
  | { ok: true; pendingEmailConfirmation?: boolean }
  | { ok: false; error: string };

export function useEmailPasswordAuth({
  next,
  onAuthSuccess,
}: UseEmailPasswordAuthArgs) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const safeNext = next.startsWith("/") ? next : "/";
  const toastParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("toast")
      : null;
  const nextWithToast = (() => {
    if (!toastParam) return safeNext;
    try {
      const nextUrl = new URL(safeNext, "http://handi.local");
      if (!nextUrl.searchParams.has("toast")) {
        nextUrl.searchParams.set("toast", toastParam);
      }
      return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    } catch {
      return safeNext;
    }
  })();

  const submit = async (
    mode: EmailAuthMode,
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const base =
          typeof window !== "undefined"
            ? window.location.origin.replace(/\/$/, "")
            : "";
        const emailRedirectTo = base
          ? `${base}/auth/callback?next=${encodeURIComponent(nextWithToast)}`
          : undefined;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
        });
        if (error) throw error;
        if (!data?.session) {
          return { ok: true, pendingEmailConfirmation: true };
        }
      }

      router.replace(nextWithToast);
      router.refresh();
      onAuthSuccess?.();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Error al iniciar sesión",
      };
    } finally {
      setLoading(false);
    }
  };

  return { loading, submit };
}
