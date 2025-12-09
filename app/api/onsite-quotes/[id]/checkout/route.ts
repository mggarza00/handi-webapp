import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = (params?.id || "").trim();
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400, headers: JSONH });

    const stripe = await getStripe();
    if (!stripe) return NextResponse.json({ error: "SERVER_MISCONFIGURED:STRIPE" }, { status: 500, headers: JSONH });
    const admin = createServerClient();
    const { data: row } = await admin
      .from("onsite_quote_requests")
      .select("id, conversation_id, deposit_checkout_url, deposit_amount")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: JSONH });

    if ((row as any).deposit_checkout_url) {
      return NextResponse.json({ ok: true, checkoutUrl: (row as any).deposit_checkout_url }, { status: 200, headers: JSONH });
    }

    const amount = Number((row as any).deposit_amount ?? 200);
    const unit_amount = Math.max(200, Math.round(amount * 100));
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${APP_URL}/mensajes/${encodeURIComponent((row as any).conversation_id || '')}?status=deposit_success`,
      cancel_url: `${APP_URL}/mensajes/${encodeURIComponent((row as any).conversation_id || '')}?status=deposit_cancel`,
      line_items: [
        {
          price_data: { currency: "mxn", product_data: { name: "Depósito para cotización en sitio" }, unit_amount },
          quantity: 1,
        },
      ],
      metadata: { type: "onsite_deposit", onsite_quote_request_id: id, conversation_id: (row as any).conversation_id || "" },
    });
    const url = session.url || null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("onsite_quote_requests")
      .update({ deposit_checkout_url: url })
      .eq("id", id);
    return NextResponse.json({ ok: true, checkoutUrl: url }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
