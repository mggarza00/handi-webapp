import { NextResponse } from "next/server";
import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    let user = (await getDevUserFromHeader(_req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(_req));
    const admin = createServerClient();
    const id = (params?.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });
    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id, onsite_quote_required")
      .eq("id", id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    const uid = user.id;
    if (uid !== (conv as any).customer_id && uid !== (conv as any).pro_id)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });
    return NextResponse.json({ ok: true, data: conv }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

