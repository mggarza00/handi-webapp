import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const BodySchema = z.object({
  request_id: z.string().uuid(),         // ID de la solicitud de servicio
  amount_mxn: z.number().int().positive().optional(), // opcional; por defecto usa NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN
  agreement_id: z.string().uuid().optional(), // opcional; si existe, se marca como paid en webhook
});

export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return new NextResponse(JSON.stringify({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }), { status: 415, headers: JSONH });
    }

    const { user } = await getUserOrThrow();

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const DEFAULT_FEE = Number(process.env.NEXT_PUBLIC_STRIPE_PRICE_FEE_MXN ?? "0");
    if (!STRIPE_SECRET_KEY) {
      return new NextResponse(JSON.stringify({ ok: false, error: "SERVER_MISCONFIGURED:STRIPE_SECRET_KEY" }), { status: 500, headers: JSONH });
    }
    if (!DEFAULT_FEE) {
      return new NextResponse(JSON.stringify({ ok: false, error: "SERVER_MISCONFIGURED:DEFAULT_FEE" }), { status: 500, headers: JSONH });
    }

    const body = BodySchema.parse(await req.json());
    const amount = (body.amount_mxn ?? DEFAULT_FEE) * 100; // a centavos

    // Ajuste de versión API según typings instalados
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${origin}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payments/cancel`,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: "Handee Service Fee" },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        request_id: body.request_id,
        user_id: user.id,
        agreement_id: body.agreement_id ?? "",
      },
    });

    return NextResponse.json({ ok: true, id: session.id, url: session.url }, { status: 201, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return new NextResponse(JSON.stringify({ ok: false, error: "CHECKOUT_FAILED", detail: msg }), { status: 400, headers: JSONH });
  }
}

export function GET() {
  return new NextResponse(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), { status: 405, headers: JSONH });
}
