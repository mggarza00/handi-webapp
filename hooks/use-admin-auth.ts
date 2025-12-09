"use client";

import { useEffect, useMemo, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase-browser";

type AdminRole = "owner" | "admin" | "ops" | "finance" | "support" | "reviewer" | "client" | "pro" | null;

export function useAdminAuth() {
  const supabase = supabaseBrowser;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null>(null);
  const [role, setRole] = useState<AdminRole>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
      if (!data.user) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role, is_admin")
          .eq("id", data.user.id)
          .maybeSingle();
        const r = ((prof as unknown as { role?: string | null } | null)?.role as string | null) ?? null;
        const isAdmin = (prof as unknown as { is_admin?: boolean | null } | null)?.is_admin === true;
        setRole((isAdmin ? "admin" : r) as AdminRole);
      } finally {
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // Refetch user+role on auth changes
      (async () => {
        const { data } = await supabase.auth.getUser();
        setUser(data.user ?? null);
        if (data.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role, is_admin")
            .eq("id", data.user.id)
            .maybeSingle();
          const r = ((prof as unknown as { role?: string | null } | null)?.role as string | null) ?? null;
          const isAdmin = (prof as unknown as { is_admin?: boolean | null } | null)?.is_admin === true;
          setRole((isAdmin ? "admin" : r) as AdminRole);
        } else {
          setRole(null);
        }
      })();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    try {
      await fetch("/auth/sign-out", { method: "POST" });
    } finally {
      window.location.href = "/auth/sign-in";
    }
  };

  const canAccessAdmin = useMemo(() => {
    if (!user) return false;
    const allowed = new Set(["owner", "admin", "ops", "finance", "support", "reviewer"]);
    return allowed.has((role || "").toString().toLowerCase());
  }, [user, role]);

  return { loading, user, role, canAccessAdmin, signOut };
}
