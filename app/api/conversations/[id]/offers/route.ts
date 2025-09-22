import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { assertRateLimit } from "@/lib/rate/limit";
import { validateOfferFields } from "@/lib/safety/offer-guard";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  professionalId: z.string().uuid().optional(),
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  amount: z.union([z.number(), z.string()]),
  currency: z.string().min(1).max(10).optional(),
  serviceDate: z.string().optional(),
});

type BodyInput = z.infer<typeof BodySchema>;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const rate = await assertRateLimit("offer.create", 60, 5);
    if (!rate.ok)
      return NextResponse.json(
        { error: "RATE_LIMIT", message: rate.message },
        { status: rate.status, headers: JSONH },
      );

    const conversationId = params.id;
    if (!conversationId)
      return NextResponse.json({ error: "MISSING_CONVERSATION" }, { status: 400, headers: JSONH });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const body: BodyInput = parsed.data;

    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .select("customer_id, pro_id")
      .eq("id", conversationId)
      .single();

    if (convoErr || !convo)
      return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (convo.customer_id !== user.id)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const professionalId = body.professionalId ?? convo.pro_id;
    if (!professionalId)
      return NextResponse.json({ error: "PROFESSIONAL_NOT_FOUND" }, { status: 400, headers: JSONH });
    if (body.professionalId && body.professionalId !== convo.pro_id)
      return NextResponse.json({ error: "PRO_MISMATCH" }, { status: 409, headers: JSONH });

    const amountNumber = typeof body.amount === "string" ? Number(body.amount) : body.amount;
    if (!Number.isFinite(amountNumber) || amountNumber <= 0)
      return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400, headers: JSONH });

    const guard = validateOfferFields({
      title: body.title.trim(),
      description: body.description ? body.description.trim() : null,
    });
    if (!guard.ok)
      return NextResponse.json(
        { error: guard.error, message: guard.message, findings: guard.findings },
        { status: 422, headers: JSONH },
      );

    let serviceDateIso: string | null = null;
    if (body.serviceDate) {
      const parsedDate = new Date(body.serviceDate);
      if (Number.isNaN(parsedDate.getTime()))
        return NextResponse.json({ error: "INVALID_SERVICE_DATE" }, { status: 400, headers: JSONH });
      serviceDateIso = parsedDate.toISOString();
    }

    const { data: offer, error } = await supabase
      .from("offers")
      .insert({
        conversation_id: conversationId,
        client_id: user.id,
        professional_id: professionalId,
        title: guard.payload.title,
        description: guard.payload.description ?? null,
        currency: (body.currency || "MXN").toUpperCase(),
        amount: Math.round((amountNumber + Number.EPSILON) * 100) / 100,
        service_date: serviceDateIso,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error || !offer)
      return NextResponse.json({ error: error?.message || "OFFER_CREATE_FAILED" }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true, offer }, { status: 201, headers: JSONH });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
