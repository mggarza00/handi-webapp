import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const offerId = (params?.id || "").trim();
    if (!offerId) return NextResponse.json({ ok: false, error: "MISSING_OFFER" }, { status: 400, headers: JSONH });

    const db = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await db.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const { data: offer, error } = await db
      .from("offers")
      .select("id, conversation_id, client_id, professional_id, status, payment_intent_id")
      .eq("id", offerId)
      .single();
    if (error || !offer) return NextResponse.json({ ok: false, error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });
    if (offer.client_id !== userId && offer.professional_id !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const convId = offer.conversation_id as string | null;
    if (!convId) return NextResponse.json({ ok: false, error: "MISSING_CONVERSATION" }, { status: 400, headers: JSONH });
    if (String(offer.status).toLowerCase() !== "paid") return NextResponse.json({ ok: false, status: offer.status }, { status: 200, headers: JSONH });

    const { data: existing } = await db
      .from("messages")
      .select("id, payload")
      .eq("conversation_id", convId)
      .eq("message_type", "system")
      .contains("payload", { offer_id: offerId, status: "paid" })
      .limit(1);
    if (Array.isArray(existing) && existing.length) {
      const p = existing[0]?.payload as unknown;
      let receiptUrl: string | null = null;
      if (p && typeof p === "object" && typeof (p as any).receipt_url === "string") receiptUrl = (p as any).receipt_url as string;
      return NextResponse.json({ ok: true, created: false, receiptUrl }, { status: 200, headers: JSONH });
    }

    let receiptUrl: string | null = null;
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      const piId = (offer as any)?.payment_intent_id as string | null;
      if (key && piId) {
        const stripe = new Stripe(key, { apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"] });
        const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
        const anyCharge: any = (pi as any)?.latest_charge || null;
        const rec = typeof anyCharge?.receipt_url === "string" ? anyCharge.receipt_url : null;
        if (rec) receiptUrl = rec;
      }
    } catch {}

    const payload: Record<string, unknown> = { offer_id: offerId, status: "paid" };
    if (receiptUrl) payload.receipt_url = receiptUrl;
    await db.from("messages").insert({ conversation_id: convId, sender_id: offer.client_id, body: "Pago realizado. Servicio agendado.", message_type: "system", payload });

    return NextResponse.json({ ok: true, created: true, receiptUrl }, { status: 200, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

