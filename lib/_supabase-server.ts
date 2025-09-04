// lib/_supabase-server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

type DBClient = SupabaseClient<Database, 'public', 'public'>;

export type AuthContext = {
  supabase: DBClient;
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

export function getSupabaseServer(): DBClient {
  const cookieStore = cookies();

  // Importante: En Server Components, Next.js no permite mutar cookies.
  // Por eso, set/remove son NO-OP aquí para evitar el error
  // "Cookies can only be modified in a Server Action or Route Handler".
  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(_name: string, _value: string, _options: CookieOptions) {
        // no-op en RSC
      },
      remove(_name: string, _options: CookieOptions) {
        // no-op en RSC
      },
    },
  });
  return client as unknown as DBClient;
}

export const supabaseServer = getSupabaseServer;

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}

export async function getUserOrThrow(): Promise<{ supabase: DBClient; user: User }> {
  const { supabase, user } = await getAuthContext();
  if (!user) throw new ApiError(401, "UNAUTHORIZED");
  return { supabase, user };
}
