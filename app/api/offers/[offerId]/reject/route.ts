import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { offerId: string } }) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id)
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const offerId = params.offerId;
    if (!offerId)
      return NextResponse.json({ ok: false, error: "MISSING_OFFER" }, { status: 400, headers: JSONH });

    const rawBody = await req.text();
    let bodyJson: unknown = {};
    if (rawBody.trim().length) {
      try {
        bodyJson = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400, headers: JSONH });
      }
    }
    const payload = BodySchema.safeParse(bodyJson);
    if (!payload.success)
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", detail: payload.error.flatten() },
        { status: 422, headers: JSONH },
      );
    const reason = payload.data.reason?.trim() || null;

    const { data: offer, error } = await supabase
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();

    if (error || !offer)
      return NextResponse.json({ ok: false, error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (offer.professional_id !== auth.user.id)
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    if (offer.status !== "sent")
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409, headers: JSONH });

    const { data: updated, error: upErr } = await supabase
      .from("offers")
      .update({ status: "rejected", reject_reason: reason })
      .eq("id", offer.id)
      .eq("professional_id", auth.user.id)
      .eq("status", "sent")
      .select("*")
      .single();

    if (upErr || !updated)
      return NextResponse.json({ ok: false, error: upErr?.message || "OFFER_UPDATE_FAILED" }, { status: 400, headers: JSONH });

    return NextResponse.json({ ok: true, offer: updated }, { status: 200, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
