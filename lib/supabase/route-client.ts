import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr/dist/main/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Route handler client para API routes (app/api/.../route.ts).
 * Fuerza cookieEncoding base64 para evitar parseos JSON.
 */
export function getRouteClient(): SupabaseClient<Database> {
  const cookieStore = cookies();
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
        // ignore write errors
      }
    },
  };

  return createServerClient<Database>(url, anon, {
    cookieEncoding: "base64" as unknown as "base64url",
    // cookieOptions: { name: 'sb-<PROJECT-REF>-auth-token', domain: '.handi.mx', sameSite: 'lax' },
    cookies: cookieMethods,
  });
}

export default getRouteClient;
