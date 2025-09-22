import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import { assertRateLimit } from "@/lib/rate/limit";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(req: Request, { params }: { params: { offerId: string } }) {
  let session: Stripe.Checkout.Session | null = null;
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY)
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500, headers: JSONH });

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"] });

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const rate = await assertRateLimit("offer.accept", 30, 3);
    if (!rate.ok)
      return NextResponse.json(
        { error: "RATE_LIMIT", message: rate.message },
        { status: rate.status, headers: JSONH },
      );

    const offerId = params.offerId;
    if (!offerId)
      return NextResponse.json({ error: "MISSING_OFFER" }, { status: 400, headers: JSONH });

    const { data: offer, error } = await supabase
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();
    if (error || !offer)
      return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (offer.professional_id !== user.id)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });
    if (offer.status !== "sent")
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409, headers: JSONH });

    const { data: locked, error: lockErr } = await supabase
      .from("offers")
      .update({ accepting_at: new Date().toISOString() })
      .eq("id", offer.id)
      .eq("professional_id", user.id)
      .is("accepting_at", null)
      .eq("status", "sent")
      .select("*")
      .single();

    if (lockErr || !locked)
      return NextResponse.json(
        { error: "LOCKED", message: "Ya se esta procesando la oferta" },
        { status: 409, headers: JSONH },
      );

    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${APP_URL}/offers/${offer.id}?status=success`,
        cancel_url: `${APP_URL}/offers/${offer.id}?status=cancel`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (locked.currency || "MXN").toLowerCase(),
              unit_amount: Math.round(Number(locked.amount) * 100),
              product_data: {
                name: locked.title,
                description: locked.description || undefined,
              },
            },
          },
        ],
        metadata: {
          offer_id: locked.id,
          conversation_id: locked.conversation_id,
        },
      });
    } catch (error) {
      await supabase.from("offers").update({ accepting_at: null }).eq("id", offer.id);
      throw error;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("offers")
      .update({ status: "accepted", checkout_url: session.url ?? null, accepting_at: null })
      .eq("id", offer.id)
      .eq("status", "sent")
      .select("*")
      .single();

    if (updateErr || !updated) {
      await supabase.from("offers").update({ accepting_at: null }).eq("id", offer.id);
      return NextResponse.json(
        { error: "INVALID_STATUS", checkoutUrl: session.url ?? null },
        { status: 409, headers: JSONH },
      );
    }

    if (session.url) {
      await fetch(`${APP_URL}/api/notify/offer-accepted`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ offerId: offer.id }),
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, offer: updated, checkoutUrl: session.url }, { status: 200, headers: JSONH });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
