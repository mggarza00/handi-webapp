import { NextResponse } from "next/server";
import { z } from "zod";
import getRouteClient from "@/lib/supabase/route-client";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  request_id: z.string().uuid(),
  // Accept either professional_id or to_user_id (alias)
  professional_id: z.string().uuid().optional(),
  to_user_id: z.string().uuid().optional(),
  // Accept either price or amount (alias)
  price: z.union([z.number(), z.string()]).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  currency: z.string().min(1).max(10).optional(),
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  service_date: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
    const body = parsed.data;

    const db = getRouteClient();
    const { data: auth } = await db.auth.getUser();
    if (!auth?.user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // Validate request ownership
    const { data: reqRow, error: reqErr } = await db
      .from("requests")
      .select("id, created_by")
      .eq("id", body.request_id)
      .maybeSingle();
    if (reqErr || !reqRow)
      return NextResponse.json({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404, headers: JSONH });
    if (reqRow.created_by !== auth.user.id)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const professionalId = (body.professional_id || body.to_user_id) as string | undefined;
    if (!professionalId)
      return NextResponse.json({ ok: false, error: "MISSING_PROFESSIONAL" }, { status: 400, headers: JSONH });

    // Ensure conversation exists between customer and professional for this request
    const up = await db
      .from("conversations")
      .upsert(
        [
          {
            request_id: body.request_id,
            customer_id: auth.user.id,
            pro_id: professionalId,
          },
        ],
        { onConflict: "request_id,customer_id,pro_id" },
      )
      .select("id")
      .single();
    if (up.error || !up.data)
      return NextResponse.json({ ok: false, error: up.error?.message || "CONVERSATION_UPSERT_FAILED" }, { status: 400, headers: JSONH });
    const conversationId = up.data.id as string;

    // Normalize amount/currency/title/description
    const amountRaw = body.amount ?? body.price ?? 0;
    const amountNum = typeof amountRaw === "string" ? Number(amountRaw) : amountRaw;
    const amount = Math.round((Number(amountNum) + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400, headers: JSONH });
    const currency = (body.currency || "MXN").toUpperCase();
    const title = (body.title || "Propuesta de servicio").slice(0, 160);
    const description = body.description ? String(body.description).slice(0, 2000) : null;
    let serviceDateIso: string | null = null;
    if (body.service_date) {
      const d = new Date(body.service_date);
      if (Number.isNaN(d.getTime()))
        return NextResponse.json({ ok: false, error: "INVALID_SERVICE_DATE" }, { status: 400, headers: JSONH });
      serviceDateIso = d.toISOString();
    }

    const { data: offer, error } = await db
      .from("offers")
      .insert({
        conversation_id: conversationId,
        client_id: auth.user.id,
        professional_id: professionalId,
        title,
        description,
        currency,
        amount,
        service_date: serviceDateIso,
        created_by: auth.user.id,
      })
      .select("*")
      .single();
    if (error || !offer)
      return NextResponse.json({ ok: false, error: error?.message || "OFFER_CREATE_FAILED" }, { status: 400, headers: JSONH });

    // Notificar por correo al profesional: "Oferta enviada" (además del trigger de DB que crea el mensaje)
    try {
      const { notifyChatMessageByConversation } = await import('@/lib/chat-notifier');
      await notifyChatMessageByConversation({ conversationId, senderId: auth.user.id, text: 'Oferta enviada' });
    } catch { /* ignore notify errors */ }

    return NextResponse.json({ ok: true, offer, conversationId }, { status: 201, headers: JSONH });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN";
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ ok: false, error: message }, { status, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
