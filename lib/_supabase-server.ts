// lib/_supabase-server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export type AuthContext = {
  supabase: SupabaseClient;
  user: User | null;
};

export class ApiError extends Error {
  status: number;
  code: string;
  detail?: string;
  constructor(status: number, code: string, detail?: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function getSupabaseServer(): SupabaseClient {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
    // Nota: si tu versión de @supabase/ssr no tipa 'headers', no lo incluyas aquí.
  });
}

export const supabaseServer = getSupabaseServer;

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}

export async function getUserOrThrow(): Promise<{ supabase: SupabaseClient; user: User }> {
  const { supabase, user } = await getAuthContext();
  if (!user) throw new ApiError(401, "UNAUTHORIZED");
  return { supabase, user };
}
