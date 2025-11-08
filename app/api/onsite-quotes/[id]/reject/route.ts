import { NextResponse } from "next/server";
import { z } from "zod";

import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";
import { notifyChatMessageByConversation } from "@/lib/chat-notifier";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({ reason: z.string().min(1), description: z.string().optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();
    const id = (params?.id || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400, headers: JSONH });
    const payload = BodySchema.parse(await req.json());
    const { data: row } = await admin
      .from("onsite_quote_requests")
      .select("id, conversation_id, professional_id, client_id")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    if (String((row as any).professional_id) !== user.id) return NextResponse.json({ ok: false, error: "ONLY_PRO" }, { status: 403, headers: JSONH });
    await admin.from("onsite_quote_requests").update({ status: "rejected" }).eq("id", id);
    // Post a reasoned message (trigger posts generic one)
    await admin.from("messages").insert({
      conversation_id: (row as any).conversation_id,
      sender_id: user.id,
      body: payload.description ? `Cotización en sitio rechazada: ${payload.reason} — ${payload.description}` : `Cotización en sitio rechazada: ${payload.reason}`,
      message_type: "system",
      payload: { onsite_request_id: id, status: "rejected", reason: payload.reason, description: payload.description ?? null } as any,
    } as any);
    try {
      const text = payload.description ? `Cotización en sitio rechazada: ${payload.reason} — ${payload.description}` : `Cotización en sitio rechazada: ${payload.reason}`;
      await notifyChatMessageByConversation({ conversationId: (row as any).conversation_id, senderId: user.id, text });
    } catch {}
    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
