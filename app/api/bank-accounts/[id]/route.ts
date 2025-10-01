import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const JSONH = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_client_pro")
      .eq("id", user.id)
      .maybeSingle();
    const isPro = (profile?.role as unknown as string) === "professional" || Boolean((profile as unknown as { is_client_pro?: boolean })?.is_client_pro);
    if (!isPro) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const id = params?.id;
    if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400, headers: JSONH });
    const body = (await req.json().catch(() => ({}))) as { is_default?: boolean };
    if (!body?.is_default) return NextResponse.json({ error: "NOOP" }, { status: 400, headers: JSONH });

    // Demote any existing confirmed
    const { error: archErr } = await supabase
      .from("bank_accounts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("status", "confirmed");
    if (archErr) return NextResponse.json({ error: archErr.message }, { status: 400, headers: JSONH });

    // Promote selected to confirmed
    const { error: confErr } = await supabase
      .from("bank_accounts")
      .update({ status: "confirmed", verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("profile_id", user.id);
    if (confErr) return NextResponse.json({ error: confErr.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

