import { NextRequest, NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient() as any;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id || null;
    if (!uid) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const id = String(params.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: JSONH });

    const { error } = await supabase
      .from("user_addresses")
      .delete()
      .eq("id", id)
      .eq("profile_id", uid);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers: JSONH });
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

