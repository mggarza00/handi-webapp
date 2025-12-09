import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr/dist/main/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Server client para layouts, server components y server actions.
 * Usa el mismo encoding de cookies para mantener consistencia.
 */
export function getServerClient(): SupabaseClient<Database> {
  const cookieStore = cookies();
  // headers() sólo si lo requieres en hooks SSR; se expone por si lo necesitas.
  void headers();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Missing Supabase env vars");

  type CookieSetOptions = {
    path?: string;
    domain?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
    httpOnly?: boolean;
    expires?: Date;
    maxAge?: number;
  };

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          const setOptions: CookieSetOptions = { path: "/", ...options } as CookieSetOptions;
          cookieStore.set({ name, value, ...setOptions });
        });
      } catch {
        // En algunos contextos RSC no se permite escribir cookies; tolerar
      }
    },
  };

  return createServerClient<Database>(url, anon, {
    cookieEncoding: "base64" as unknown as "base64url",
    // cookieOptions: { name: 'sb-<PROJECT-REF>-auth-token', domain: '.handi.mx', sameSite: 'lax' },
    cookies: cookieMethods,
  });
}

export default getServerClient;
