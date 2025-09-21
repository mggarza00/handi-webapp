import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";

/** Opciones de cookie compatibles con Next cookies().set */
type CookieOpts = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  expires?: Date;
  maxAge?: number;
};

export function getSupabaseServer() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anon, {
    cookies: {
      get(name: string): string | undefined {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Omit<CookieOpts, "name" | "value">): void {
        try { cookieStore.set({ name, value, ...options }); } catch { /* noop */ }
      },
      remove(name: string, options: Omit<CookieOpts, "name" | "value">): void {
        try { cookieStore.set({ name, value: "", ...options }); } catch { /* noop */ }
      },
    },
  });
}

/** Admin client (omite RLS). SOLO servidor. */
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !service) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createAdmin(url, service, { auth: { persistSession: false } });
}
