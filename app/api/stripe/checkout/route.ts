import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  agreement_id: z.string().uuid().optional(),
});
type Body = z.infer<typeof BodySchema>;

function getBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl.replace(/\/+$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: sesErr } = await supabase.auth.getSession();

    const hasStripeKey = Boolean(process.env.STRIPE_SECRET_KEY);
    const feeStr = process.env.STRIPE_FEE_AMOUNT_MXN ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN ?? "";
    const fee = Number(feeStr);

    return NextResponse.json(
      {
        ok: true,
        diag: {
          stripeKeyPresent: hasStripeKey,
          feeConfigured: Number.isFinite(fee) && fee > 0,
          stripeImportOk: await import("stripe").then(() => true).catch(() => false),
          hasUser: Boolean(session?.user),
          supabaseError: sesErr?.message ?? null,
          baseUrl: getBaseUrl(req),
          fee
        }
      },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json({ ok: false, error: "unexpected_failure", detail: msg }, { status: 500, headers: JSON_HEADERS });
  }
}

export async function POST(req: Request) {
  try {
    // 1) GUARDIA DE SESIÓN (antes que nada)
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session }, error: sesErr } = await supabase.auth.getSession();
    if (sesErr || !session?.user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized", detail: sesErr?.message ?? "no_session" },
        { status: 401, headers: JSON_HEADERS }
      );
    }
    const user = session.user;

    // 2) Validar ENV Stripe y monto
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return NextResponse.json(
        { ok: false, error: "stripe_misconfigured", detail: "STRIPE_SECRET_KEY requerido (solo servidor)." },
        { status: 500, headers: JSON_HEADERS }
      );
    }
    const feeStr =
      process.env.STRIPE_FEE_AMOUNT_MXN ??
      process.env.NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN ??
      "";
    const fee = Number(feeStr);
    if (!Number.isFinite(fee) || fee <= 0) {
      return NextResponse.json(
        { ok: false, error: "fee_not_configured", detail: "Configura STRIPE_FEE_AMOUNT_MXN o NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN." },
        { status: 500, headers: JSON_HEADERS }
      );
    }

    // 3) Validar body
    const bodyUnknown = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(bodyUnknown);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400, headers: JSON_HEADERS }
      );
    }
    const input: Body = parsed.data;

    // 4) Stripe: import dinámico y crear sesión
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-07-30.basil" });

    const baseUrl = getBaseUrl(req);
    const sessionStripe = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: { name: "Comisión Handee" },
          unit_amount: Math.round(fee * 100),
        },
        quantity: 1,
      }],
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id, agreement_id: input.agreement_id ?? "" },
      success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payments/cancelled`,
    });

    return NextResponse.json({ ok: true, url: sessionStripe.url }, { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected_error";
    return NextResponse.json(
      { ok: false, error: "unexpected_failure", detail: msg },
      { status: 500, headers: JSON_HEADERS }
    );
  }
}
