import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request, { params }: { params: { offerId: string } }) {
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (!STRIPE_SECRET_KEY)
      return NextResponse.json({ ok: false, error: "SERVER_MISCONFIGURED:STRIPE_KEY" }, { status: 500, headers: JSONH });

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id)
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const offerId = params.offerId;
    if (!offerId)
      return NextResponse.json({ ok: false, error: "MISSING_OFFER" }, { status: 400, headers: JSONH });

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

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    const amountCents = Math.round(Number(offer.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0)
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400, headers: JSONH });

    const successUrlBase = APP_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${successUrlBase}/mensajes/${offer.conversation_id}?offer=${offer.id}&status=success`,
      cancel_url: `${successUrlBase}/mensajes/${offer.conversation_id}?offer=${offer.id}&status=cancel`,
      customer_email: undefined,
      metadata: { offer_id: offer.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (offer.currency || "MXN").toLowerCase(),
            unit_amount: amountCents,
            product_data: {
              name: offer.title,
              description: offer.description || undefined,
            },
          },
        },
      ],
    });

    const update = await supabase
      .from("offers")
      .update({
        status: "accepted",
        checkout_url: session.url,
        payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("id", offer.id)
      .eq("professional_id", auth.user.id)
      .eq("status", "sent")
      .select("*")
      .single();

    if (update.error || !update.data)
      return NextResponse.json(
        { ok: false, error: update.error?.message || "OFFER_UPDATE_FAILED" },
        { status: 400, headers: JSONH },
      );

    if (session.url) {
      const notifyUrl = `${successUrlBase}/api/notify/offer-accepted`;
      await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ offerId: offer.id, checkoutUrl: session.url }),
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { ok: true, offer: update.data, checkoutUrl: session.url },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
