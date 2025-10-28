import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  if (!url || !anon) return NextResponse.json({ ok: false, error: "MISSING_ENV" }, { status: 500, headers: JSONH });

  // Construye la respuesta primero para poder adjuntar cookies vía setAll
  const res = NextResponse.json({ ok: true }, { headers: JSONH });
  try {
    const supabase = createServerClient<Database>(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
              cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, { ...(options as CookieOptions), path: "/" });
            });
          } catch { /* ignore */ }
        },
      },
    });

    const body = await req.json().catch(() => null) as
      | { access_token?: string; refresh_token?: string }
      | null;

    if (body?.access_token && body?.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 401, headers: JSONH });
      // Cookies ya aplicadas en `res` por setAll; devolver el mismo response
      return res;
    }

    // Si no se envían tokens, intenta obtener sesión de cookies actuales
    const { error } = await supabase.auth.getSession();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 401, headers: JSONH });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
