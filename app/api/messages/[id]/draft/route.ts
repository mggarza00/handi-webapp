/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

import { getUserFromRequestOrThrow, getDbClientForRequest, getDevUserFromHeader } from "@/lib/auth-route";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const conversationId = params.id;

    let usedDevFallback = false;
    let { user } = (await getDevUserFromHeader(req)) ?? { user: null as any };
    if (!user) ({ user } = await getUserFromRequestOrThrow(req)); else usedDevFallback = true;
    const supabase: any = usedDevFallback ? createServiceClient() : await getDbClientForRequest(req);

    // Validate conversation and membership via conversations RLS (or explicit check)
    const conv = await supabase
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv?.data)
      return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });

    // Create empty message (draft)
    const ins = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, body: "" })
      .select("id, created_at")
      .single();
    if (ins.error)
      return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true, data: ins.data }, { status: 201, headers: JSONH });
  } catch (e) {
    const anyE = e as any;
    const status = typeof anyE?.status === "number" ? anyE.status : 500;
    const message = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json({ ok: false, error: message }, { status, headers: JSONH });
  }
}
