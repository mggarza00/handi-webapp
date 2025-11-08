import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import getRouteClient from "@/lib/supabase/route-client";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  // Construye la respuesta de éxito por defecto
  const res = NextResponse.json({ ok: true }, { headers: JSONH });
  try {
    const supabase = getRouteClient();

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
