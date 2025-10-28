import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = cookies();
  // Prepara la respuesta de redirect y engancha setAll a sus cookies
  const url = new URL("/", req.url);
  const response = NextResponse.redirect(url, { status: 303 });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, { ...(options as CookieOptions), path: "/" });
            });
          } catch {}
        },
      },
    }
  );
  await supabase.auth.signOut();
  return response;
}
