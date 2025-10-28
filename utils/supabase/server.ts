// utils/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

// Important: the third generic must be the schema type, not the string "public".
// Using the string narrows table types to never. Keep the default generics or
// pass Database["public"] explicitly to preserve table typings.
export type DBClient = SupabaseClient<Database>;

// Central SSR helper that only uses cookies.getAll() and cookies.setAll().
export function createClient(): DBClient {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishable)
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );

  return createServerClient<Database>(url, publishable, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Next accepts either positional args or an object with options
            // Ensure path is '/' so cookies apply site-wide
            cookieStore.set({ name, value, path: "/", ...(options as CookieOptions) });
          });
        } catch {
          // In RSC puros no siempre se permite escribir cookies; el middleware las reflejará
        }
      },
    },
  }) as unknown as DBClient;
}

export default createClient;
