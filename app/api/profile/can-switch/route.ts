import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user)
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );

    const uid = auth.user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_client_pro")
      .eq("id", uid)
      .maybeSingle();

    const canSwitch = Boolean(profile?.is_client_pro);
    const currentRole = (profile?.role ?? null) as
      | null
      | "client"
      | "pro"
      | "admin";
    const other =
      currentRole === "pro"
        ? "cliente"
        : currentRole === "client"
          ? "profesional"
          : null;
    return NextResponse.json(
      { ok: true, canSwitch, other },
      { headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: msg },
      { status: 500, headers: JSONH },
    );
  }
}

export function POST() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
