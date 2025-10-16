import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type OnsiteRow = {
  id: string;
  conversation_id: string | null;
  status: string;
  deposit_amount: number | null;
  deposit_checkout_url: string | null;
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
    const rowId = (params?.id || "").trim();
    if (!rowId) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400, headers: JSONH });
    }

    const { data: onsite, error } = await supabase
      .from("onsite_quote_requests")
      .select("id, conversation_id, status, deposit_amount, deposit_checkout_url")
      .eq("id", rowId)
      .single();
    if (error || !onsite) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: JSONH });
    }

    const row = onsite as OnsiteRow;
    if (row.deposit_checkout_url) {
      return NextResponse.json({ ok: true, checkoutUrl: row.deposit_checkout_url }, { status: 200, headers: JSONH });
    }

    if ((row.status || '').toLowerCase() !== 'deposit_pending') {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409, headers: JSONH });
    }

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
    if (!stripeConfigured) {
      return NextResponse.json({ ok: true, checkoutUrl: null }, { status: 200, headers: JSONH });
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"] });

    const baseAmountMx = Number(row.deposit_amount ?? 200);
    const unitAmount = Math.max(200, Math.round(Math.abs(baseAmountMx) * 100));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${APP_URL}/mensajes/${encodeURIComponent(row.conversation_id || '')}?status=deposit_success`,
      cancel_url: `${APP_URL}/mensajes/${encodeURIComponent(row.conversation_id || '')}?status=deposit_cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'mxn',
            unit_amount: unitAmount,
            product_data: { name: 'Depósito de cotización en sitio' },
          },
        },
      ],
      metadata: {
        onsite_request_id: row.id,
        conversation_id: row.conversation_id || '',
        deposit_cents: String(unitAmount),
      },
    });

    const checkoutUrl = session.url || null;
    if (checkoutUrl) {
      await supabase
        .from("onsite_quote_requests")
        .update({ deposit_checkout_url: checkoutUrl })
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

