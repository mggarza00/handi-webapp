import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

// Eleva el rol del usuario autenticado a "admin" si su email coincide con SEED_ADMIN_EMAIL
export async function POST(req: Request) {
  try {
    const allowEmail = process.env.SEED_ADMIN_EMAIL as string | undefined;
    const url = new URL(req.url);
    // Permite override por query ?email=... si se desea explícitamente
    const emailOverride = url.searchParams.get("email") || undefined;

    const supa = getRouteClient();
    const { data: auth } = await supa.auth.getUser();
    const user = auth.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    const email = (user.email || "").toLowerCase();
    const expected = (emailOverride || allowEmail || "").toLowerCase();
    if (!expected || email !== expected) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN", detail: "Email no autorizado" },
        { status: 403, headers: JSONH },
      );
    }

    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("profiles")
      .update({ role: "admin" as const })
      .eq("id", user.id)
      .select("id, role")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", detail: error.message },
        { status: 400, headers: JSONH },
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
