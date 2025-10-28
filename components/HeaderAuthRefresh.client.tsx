"use client";
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function HeaderAuthRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  // Permitir reintentar cuando `enabled` cambia de false->true en otra navegación
  const didRunForCycle = React.useRef(false);
  React.useEffect(() => {
    if (!enabled) {
      didRunForCycle.current = false;
      return;
    }
    if (didRunForCycle.current) return;
    didRunForCycle.current = true;
    const supabase = createSupabaseBrowser();
    (async () => {
      try {
        const [{ data: userData }, { data: sessData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);
        const user = userData?.user ?? null;
        let session = sessData?.session ?? null;
        if (user && session) {
          try { if (session.access_token) { supabase.realtime.setAuth(session.access_token); } } catch { /* ignore */ }
          // Check if server sees the session; if not, sync cookies then refresh
          try {
            const me = await fetch("/api/me", { cache: "no-store", credentials: "include" }).then((r) => r.json()).catch(() => ({}));
            const serverHasUser = !!me?.user?.id;
            if (!serverHasUser) {
              // Asegura que tengamos refresh_token; si falta, intenta refrescar primero
              if (!session.refresh_token) {
                try {
                  const { data: refreshed } = await supabase.auth.refreshSession();
                  if (refreshed?.session) session = refreshed.session;
                } catch {
                  /* ignore */
                }
              }
              if (session?.access_token && session?.refresh_token) {
                await fetch("/api/auth/sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json; charset=utf-8" },
                  credentials: "include",
                  body: JSON.stringify({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                  }),
                }).catch(() => undefined);
                try { if (session.access_token) { supabase.realtime.setAuth(session.access_token); } } catch { /* ignore */ }
              }
            }
          } catch {
            /* ignore */
          }
          // Pequeña pausa para que las cookies httpOnly apliquen antes del refresh
          setTimeout(() => {
            try {
              router.refresh();
            } catch {
              /* ignore */
            }
          }, 120);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [enabled, router, pathname]);
  return null;
}
