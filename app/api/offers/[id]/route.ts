import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const offerId = (params?.id || "").trim();
    if (!offerId) return NextResponse.json({ ok: false, error: "MISSING_OFFER" }, { status: 400, headers: JSONH });

    const db = getRouteClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sel: any = await (db as any)
      .from("offers")
      .select("id, conversation_id, status")
      .eq("id", offerId)
      .single();
    const data = sel?.data as unknown as { id?: string; conversation_id?: string; status?: string } | null;
    const error = sel?.error || null;
    if (error || !data) return NextResponse.json({ ok: false, error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    return NextResponse.json({ ok: true, id: data.id, status: data.status, conversationId: data.conversation_id }, { status: 200, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
