import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Cliente SSR con cookies (Next.js App Router).
 * Requiere NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createServerClient(): SupabaseClient {
  const cookieStore = cookies();
  const supabase = createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch { /* no-op en entornos edge sin mutación */ }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch { /* no-op */ }
        },
      },
    }
  );
  return supabase as unknown as SupabaseClient;
}

/** Alias legacy: varios archivos importan esto. */
export const supabaseServer = () => createServerClient();

/** Alias legacy: algunos archivos importan este nombre. */
export const createSupabaseServerClient = createServerClient;

/**
 * Devuelve user (o lanza si no hay sesión). Útil en rutas API.
 * Uso:
 *   const { supabase, user } = await getUserOrThrow();
 */
export async function getUserOrThrow(s?: SupabaseClient): Promise<{ supabase: SupabaseClient; user: User; }> {
  const supabase = s ?? createServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) {
    // Lanzamos Error simple; las rutas pueden capturarlo y responder 401.
    throw new Error("Unauthorized");
  }
  return { supabase, user };
}