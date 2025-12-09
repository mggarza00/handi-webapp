import { NextResponse } from "next/server";
import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();
    const id = (params?.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });
    const { data: row } = await admin
      .from("onsite_quote_requests")
      .select("id, conversation_id, professional_id, client_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    if (String((row as any).professional_id) !== user.id) return NextResponse.json({ ok: false, error: "ONLY_PRO" }, { status: 403, headers: JSONH });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from("onsite_quote_requests").update({ status: "accepted" }).eq("id", id);
    // trigger posts message
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
