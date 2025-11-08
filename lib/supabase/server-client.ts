import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

  return createServerClient<Database>(
    url,
    anon,
    {
      // Estándar único de encoding para cookies de sesión
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
            // En algunos contextos RSC no se permite escribir cookies; tolerar
          }
        },
      } as any,
    } as any
  );
}

export default getServerClient;
