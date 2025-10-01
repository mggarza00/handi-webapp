import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "SERVER_MISCONFIGURED:STRIPE_KEYS" }),
      { status: 500, headers: JSONH },
    );
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"] });

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "MISSING_SIGNATURE" }),
      { status: 400, headers: JSONH },
    );
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid payload";
    return new NextResponse(
      JSON.stringify({ ok: false, error: "INVALID_SIGNATURE", detail: msg }),
      { status: 400, headers: JSONH },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
        if (url && serviceRole) {
          const admin = createClient(url, serviceRole);
          const offerId = (session.metadata?.offer_id || "").trim();
          if (offerId) {
            console.log(
              JSON.stringify({
                type: "stripe.checkout.session.completed",
                offerId,
                sessionId: session.id,
              }),
            );
            await admin
              .from("offers")
              .update({
                status: "paid",
                payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
                accepting_at: null,
              })
              .eq("id", offerId)
              .in("status", ["accepted", "pending"]);
          }

          const agreementId = (session.metadata?.agreement_id || "").trim();
          if (agreementId) {
            const { data: agr } = await admin
              .from("agreements")
              .update({ status: "paid" })
              .eq("id", agreementId)
              .select("id, request_id")
              .single();
            if (agr?.request_id) {
              await admin
                .from("requests")
                .update({ status: "in_process" })
                .eq("id", agr.request_id)
                .eq("status", "active");
            }
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        // TODO: logging/alertas
        break;
      }
      default:
        break;
    }

    return NextResponse.json(
      { ok: true, received: true, type: event.type },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new NextResponse(
      JSON.stringify({ ok: false, error: "WEBHOOK_HANDLER_ERROR", detail: msg }),
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return new NextResponse(
    JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }),
    { status: 405, headers: JSONH },
  );
}
