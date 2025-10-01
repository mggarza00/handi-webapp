import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type OfferRow = {
  id: string;
  status: string;
  checkout_url: string | null;
  amount: number | null;
  currency: string | null;
  title: string | null;
  description: string | null;
  conversation_id: string | null;
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supaUrl || !serviceRole) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:SUPABASE" },
        { status: 500, headers: JSONH },
      );
    }

    const supabase = createClient(supaUrl, serviceRole, { auth: { persistSession: false } });
    const offerId = (params?.id || "").trim();
    if (!offerId) {
      return NextResponse.json({ error: "MISSING_OFFER" }, { status: 400, headers: JSONH });
    }

    const { data: offer, error } = await supabase
      .from("offers")
      .select("id,status,checkout_url,amount,currency,title,description,conversation_id")
      .eq("id", offerId)
      .single();
    if (error || !offer) {
      return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });
    }

    const row = offer as OfferRow;
    if (row.checkout_url) {
      return NextResponse.json({ ok: true, checkoutUrl: row.checkout_url }, { status: 200, headers: JSONH });
    }

    // Solo generar checkout para ofertas aceptadas
    if (String(row.status).toLowerCase() !== "accepted") {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409, headers: JSONH });
    }

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
    if (!stripeConfigured) {
      // Stripe no configurado: retorna sin URL, no es error
      return NextResponse.json({ ok: true, checkoutUrl: null }, { status: 200, headers: JSONH });
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"] });

    const amount = Number(row.amount ?? NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400, headers: JSONH });
    }

    // Compute total: servicio + comisión + IVA
    const baseAmount = Number(row.amount ?? NaN);
    const fee = Number.isFinite(baseAmount) && baseAmount > 0
      ? Math.min(1500, Math.max(50, Math.round((baseAmount * 0.05 + Number.EPSILON) * 100) / 100))
      : 0;
    const iva = Number.isFinite(baseAmount)
      ? Math.round((((baseAmount + fee) * 0.16) + Number.EPSILON) * 100) / 100
      : 0;
    const total = Number.isFinite(baseAmount) ? baseAmount + fee + iva : 0;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${APP_URL}/offers/${row.id}?status=success`,
      cancel_url: `${APP_URL}/offers/${row.id}?status=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (row.currency || "MXN").toLowerCase(),
            unit_amount: Math.round(total * 100),
            product_data: {
              name: row.title || "Servicio",
              description: row.description || undefined,
            },
          },
        },
      ],
      metadata: { offer_id: row.id, conversation_id: row.conversation_id || "" },
    });

    const checkoutUrl = session.url || null;
    if (checkoutUrl) {
      await supabase
        .from("offers")
        .update({ checkout_url: checkoutUrl })
        .eq("id", row.id);
    }

    return NextResponse.json({ ok: true, checkoutUrl }, { status: 200, headers: JSONH });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
