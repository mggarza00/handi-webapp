import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

// Fallback WHSEC (el que indicaste). Se usa si no existe STRIPE_WEBHOOK_SECRET en env.
const WHSEC_FALLBACK = "whsec_863767933d1271157d9d2bfa799765da7c241b377d829192079f7dd608c13cfd";

// Env para Supabase (solo servidor)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function markAgreementPaid(agreementId: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("supabase_misconfigured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/agreements?id=eq.${agreementId}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json; charset=utf-8",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "paid" }),
  });
  if (!res.ok) throw new Error(`agreements_update_failed:${res.status} ${await res.text().catch(()=> "")}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("diag") !== "1") {
    return NextResponse.json({ ok: true, route: "/api/stripe/webhook" }, { status: 200, headers: JSON_HEADERS });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET || WHSEC_FALLBACK;
  return NextResponse.json(
    {
      ok: true,
      diag: {
        hasSupabaseUrl: Boolean(SUPABASE_URL),
        hasServiceRole: Boolean(SERVICE_ROLE),
        whsecLen: secret.length,
        whsecSuffix: secret.slice(-6),
        usingFallback: !process.env.STRIPE_WEBHOOK_SECRET,
        now: new Date().toISOString(),
      },
    },
    { status: 200, headers: JSON_HEADERS }
  );
}

export async function POST(req: Request) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ ok: false, error: "invalid_signature", detail: "missing" }, { status: 400, headers: JSON_HEADERS });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET || WHSEC_FALLBACK;
    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "construct_event_failed";
      console.error("[webhook] invalid_signature:", msg);
      return NextResponse.json({ ok: false, error: "invalid_signature", detail: msg }, { status: 400, headers: JSON_HEADERS });
    }

    console.log("[webhook] type:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const agreementId = session.metadata?.agreement_id;
      console.log("[webhook] session.metadata:", session.metadata);
      if (!agreementId) {
        return NextResponse.json({ ok: true, skipped: true, reason: "no_agreement_id" }, { status: 200, headers: JSON_HEADERS });
      }
      await markAgreementPaid(agreementId);
      console.log("[webhook] updated agreement to paid:", agreementId);
      return NextResponse.json({ ok: true, updated: agreementId }, { status: 200, headers: JSON_HEADERS });
    }

    return NextResponse.json({ ok: true, received: event.type }, { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    console.error("[webhook] error:", msg);
    return NextResponse.json({ ok: false, error: "webhook_error", detail: msg }, { status: 500, headers: JSON_HEADERS });
  }
}
