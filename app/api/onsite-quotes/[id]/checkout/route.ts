import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";
import { computeClientTotalsCents } from "@/lib/payments/fees";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function normalizeBaseUrl(raw?: string | null): string | null {
  const candidate = (raw || "").trim();
  if (!candidate) return null;
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    const parsed = new URL(withProtocol);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function normalizeCheckoutUrl(raw?: string | null): string | null {
  const candidate = (raw || "").trim();
  if (!candidate) return null;
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function resolveAppBaseUrl(req: Request): string {
  const fromEnv =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromEnv) return fromEnv;
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = (params?.id || "").trim();
    if (!id)
      return NextResponse.json(
        { error: "MISSING_ID" },
        { status: 400, headers: JSONH },
      );

    const stripe = await getStripe();
    if (!stripe)
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:STRIPE" },
        { status: 500, headers: JSONH },
      );
    const admin = createServerClient();
    const { data: row } = await admin
      .from("onsite_quote_requests")
      .select("id, conversation_id, deposit_checkout_url, deposit_amount")
      .eq("id", id)
      .maybeSingle();
    if (!row)
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );

    const validStoredCheckout = normalizeCheckoutUrl(
      (row as any).deposit_checkout_url,
    );
    if (validStoredCheckout) {
      return NextResponse.json(
        { ok: true, checkoutUrl: validStoredCheckout },
        { status: 200, headers: JSONH },
      );
    }
    if ((row as any).deposit_checkout_url) {
      await (admin as any)
        .from("onsite_quote_requests")
        .update({ deposit_checkout_url: null })
        .eq("id", id);
    }

    const amount = Number((row as any).deposit_amount ?? 200);
    const safeAmount = Math.max(0, Math.round(Math.abs(amount) * 100) / 100);
    const { baseCents, feeCents, ivaCents, totalCents } =
      computeClientTotalsCents(safeAmount);
    const unit_amount = Math.max(200, totalCents);
    const appBaseUrl = resolveAppBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${appBaseUrl}/mensajes/${encodeURIComponent((row as any).conversation_id || "")}?status=deposit_success`,
      cancel_url: `${appBaseUrl}/mensajes/${encodeURIComponent((row as any).conversation_id || "")}?status=deposit_cancel`,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: "Depósito para cotización en sitio" },
            unit_amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "onsite_deposit",
        onsite_quote_request_id: id,
        onsite_request_id: id,
        conversation_id: (row as any).conversation_id || "",
        deposit_base_cents: String(baseCents),
        deposit_fee_cents: String(feeCents),
        deposit_iva_cents: String(ivaCents),
        deposit_total_cents: String(unit_amount),
        base_cents: String(baseCents),
        commission_cents: String(feeCents),
        iva_cents: String(ivaCents),
        total_cents: String(unit_amount),
      },
    });
    const url = normalizeCheckoutUrl(session.url || null);
    if (!url) {
      return NextResponse.json(
        { error: "CHECKOUT_URL_INVALID" },
        { status: 502, headers: JSONH },
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("onsite_quote_requests")
      .update({
        deposit_checkout_url: url,
        deposit_base_cents: baseCents,
        deposit_fee_cents: feeCents,
        deposit_iva_cents: ivaCents,
        deposit_total_cents: unit_amount,
      })
      .eq("id", id);
    return NextResponse.json(
      { ok: true, checkoutUrl: url },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
