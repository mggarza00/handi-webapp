import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const targetId = (params?.id || "").trim();
    if (!targetId)
      return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const me = auth?.user?.id || null;
    if (!me)
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // Verify there's at least one conversation between requester and target
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(customer_id.eq.${me},pro_id.eq.${targetId}),and(customer_id.eq.${targetId},pro_id.eq.${me})`)
      .limit(1)
      .maybeSingle();
    if (!conv)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    // Use admin client to bypass potential RLS on profiles/professionals
    const admin = getAdminSupabase();
    // Prefer professionals.full_name/avatar if present; otherwise profiles
    const [{ data: prof }, { data: pro }] = await Promise.all([
      admin.from("profiles").select("id, full_name, avatar_url").eq("id", targetId).maybeSingle(),
      admin.from("professionals").select("id, full_name, avatar_url").eq("id", targetId).maybeSingle(),
    ]);
    const full_name = (pro?.full_name as string) || (prof?.full_name as string) || null;
    const avatar_url = (pro?.avatar_url as string) || (prof?.avatar_url as string) || null;

    if (!full_name && !avatar_url)
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });

    return NextResponse.json(
      { ok: true, data: { id: targetId, full_name, avatar_url } },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
