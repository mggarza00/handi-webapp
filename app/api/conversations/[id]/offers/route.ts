import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  amount: z.union([z.number(), z.string()]),
  currency: z.string().min(1).max(10).optional(),
  serviceDate: z.string().optional(),
  professionalId: z.string().uuid().optional(),
});

type BodyInput = z.infer<typeof BodySchema>;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json"))
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id)
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const conversationId = params.id;
    if (!conversationId)
      return NextResponse.json({ ok: false, error: "MISSING_CONVERSATION" }, { status: 400, headers: JSONH });

    const payload = BodySchema.safeParse(await req.json());
    if (!payload.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: payload.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const body: BodyInput = payload.data;

    const convo = await supabase
      .from("conversations")
      .select("id, customer_id, pro_id")
      .eq("id", conversationId)
      .single();

    if (convo.error || !convo.data)
      return NextResponse.json({ ok: false, error: "CONVERSATION_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (convo.data.customer_id !== auth.user.id)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    if (body.professionalId && body.professionalId !== convo.data.pro_id)
      return NextResponse.json({ ok: false, error: "PRO_MISMATCH" }, { status: 409, headers: JSONH });

    const amountNumber = (() => {
      const raw = typeof body.amount === "string" ? body.amount.trim() : body.amount;
      const parsed = typeof raw === "string" ? Number(raw) : raw;
      if (!Number.isFinite(parsed)) return NaN;
      return parsed;
    })();
    if (!Number.isFinite(amountNumber) || amountNumber <= 0)
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400, headers: JSONH });

    const amount = Math.round((amountNumber + Number.EPSILON) * 100) / 100;
    const serviceDateIso = (() => {
      if (!body.serviceDate) return null;
      const date = new Date(body.serviceDate);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    })();

    const { data: offer, error } = await supabase
      .from("offers")
      .insert({
        conversation_id: conversationId,
        client_id: auth.user.id,
        professional_id: convo.data.pro_id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        currency: (body.currency || "MXN").toUpperCase(),
        amount,
        service_date: serviceDateIso,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error || !offer)
      return NextResponse.json(
        { ok: false, error: error?.message || "OFFER_CREATE_FAILED" },
        { status: 400, headers: JSONH },
      );

    return NextResponse.json({ ok: true, offer }, { status: 201, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
