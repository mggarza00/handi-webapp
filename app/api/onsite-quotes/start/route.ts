import { NextResponse } from "next/server";
import { z } from "zod";

import { getDevUserFromHeader, getUserFromRequestOrThrow } from "@/lib/auth-route";
import { createServerClient } from "@/lib/supabase";
import { notifyChatMessageByConversation } from "@/lib/chat-notifier";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    let user = (await getDevUserFromHeader(req))?.user ?? null;
    if (!user) ({ user } = await getUserFromRequestOrThrow(req));
    const admin = createServerClient();
    const { conversation_id } = BodySchema.parse(await req.json());

    const { data: conv } = await admin
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversation_id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403, headers: JSONH });
    if (String(conv.pro_id) !== user.id)
      return NextResponse.json({ ok: false, error: "ONLY_PRO_CAN_START" }, { status: 403, headers: JSONH });

    await admin.from("conversations").update({ onsite_quote_required: true }).eq("id", conversation_id);
    // Post chat message
    await admin.from("messages").insert({
      conversation_id,
      sender_id: user.id,
      body: "Este profesional requiere cotizar en sitio el servicio.",
      message_type: "system",
      payload: { type: "onsite_quote_start" } as any,
    } as any);
    try { void notifyChatMessageByConversation({ conversationId: conversation_id, senderId: user.id, text: "Este profesional requiere cotizar en sitio el servicio." }); } catch {}

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 400, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
