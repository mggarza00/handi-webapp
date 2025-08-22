import { cookies } from "next/headers";
import { createServerClient as _createClient, type CookieOptions } from "@supabase/ssr";
import type { Session, User } from "@supabase/supabase-js";

/** Wrapper de 0 args para RSC/route handlers con cookies SSR */
export function createServerClient() {
  const cookieStore = cookies();
  return _createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: "", ...options, expires: new Date(0) }); },
      },
    }
  );
}

/** Aliases de compatibilidad */
export const getSupabaseServerClient = createServerClient;
export const _supabaseServer = createServerClient;
export const createSupabaseServerClient = createServerClient;

/** Sesión/usuario */
export async function getSession(): Promise<Session | null> {
  const supabase = createServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** NUEVO: retorna { supabase, user } para los handlers que lo desestructuran */
export async function getUserOrThrow(): Promise<{ supabase: ReturnType<typeof createServerClient>; user: User }> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("UNAUTHORIZED");
  return { supabase, user };
}
