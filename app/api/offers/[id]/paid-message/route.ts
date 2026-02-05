import { NextResponse } from "next/server";

import { finalizeOfferPayment } from "@/lib/payments/finalize-offer-payment";
import { createClient as createServerClient } from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const offerId = (params?.id || "").trim();
    if (!offerId)
      return NextResponse.json(
        { ok: false, error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );

    const db = createServerClient();
    const { data: auth } = await db.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId)
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    const { data: offer, error } = await db
      .from("offers")
      .select(
        "id, conversation_id, client_id, professional_id, status, payment_intent_id",
      )
      .eq("id", offerId)
      .single();
    if (error || !offer)
      return NextResponse.json(
        { ok: false, error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    if (offer.client_id !== userId && offer.professional_id !== userId)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );

    if (!offer.conversation_id)
      return NextResponse.json(
        { ok: false, error: "MISSING_CONVERSATION" },
        { status: 400, headers: JSONH },
      );
    if (String(offer.status).toLowerCase() !== "paid")
      return NextResponse.json(
        { ok: false, status: offer.status },
        { status: 200, headers: JSONH },
      );

    const finalize = await finalizeOfferPayment({
      offerId,
      paymentIntentId: offer.payment_intent_id || null,
      source: "sync",
    });
    if (!finalize.ok)
      return NextResponse.json(
        { ok: false, error: "FINALIZE_FAILED" },
        { status: 500, headers: JSONH },
      );

    return NextResponse.json({ ok: true }, { status: 200, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
