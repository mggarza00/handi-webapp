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

export function useEmailPasswordAuth({ next, onAuthSuccess }: UseEmailPasswordAuthArgs) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const submit = async (mode: EmailAuthMode, email: string, password: string): Promise<AuthResult> => {
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data?.session) {
          return { ok: true, pendingEmailConfirmation: true };
        }
      }

      router.replace(next);
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
