import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

  return createServerClient<Database>(url, anon, {
    cookieEncoding: "base64",
    // Si personalizas el nombre/dominio de la cookie, hazlo aquí
    // cookieOptions: { name: 'sb-<PROJECT-REF>-auth-token', domain: '.handi.mx', sameSite: 'lax' },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: unknown) {
        try {
          cookieStore.set(name, value, { path: "/", ...(options as CookieOptions) });
        } catch {
          /* ignore */
        }
      },
      remove(name: string, options?: unknown) {
        try {
          cookieStore.set(name, "", { path: "/", maxAge: 0, expires: new Date(0), ...(options as CookieOptions) });
        } catch {
          /* ignore */
        }
      },
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, path: "/", ...(options as CookieOptions) });
          });
        } catch {
          // ignore write errors
        }
      },
    } as any,
  } as any);
}

export default getRouteClient;
