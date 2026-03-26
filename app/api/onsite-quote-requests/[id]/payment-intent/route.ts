import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getPublishableKeyForMode, getStripeForMode } from "@/lib/stripe";
import { computeClientTotalsCents } from "@/lib/payments/fees";
import type { Database } from "@/types/supabase";
import { resolveStripeModeForRequestUser } from "@/lib/payments/stripe-mode";
import { getRouteClient } from "@/lib/supabase/route-client";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type OnsiteRow = {
  id: string;
  conversation_id: string | null;
  request_id: string | null;
  client_id: string | null;
  professional_id: string | null;
  status: string;
  deposit_amount: number | null;
  is_remunerable: boolean | null;
  deposit_payment_intent_id: string | null;
};

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = supaAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:SUPABASE" },
        { status: 500, headers: JSONH },
      );
    }

    const onsiteId = (params?.id || "").trim();
    if (!onsiteId) {
      return NextResponse.json(
        { error: "MISSING_ONSITE_REQUEST" },
        { status: 400, headers: JSONH },
      );
    }

    const routeClient = getRouteClient();
    const {
      data: { user },
    } = await routeClient.auth.getUser();
    const userId = user?.id || null;
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const { data: onsiteRow, error: onsiteError } = await supabase
      .from("onsite_quote_requests")
      .select(
        "id, conversation_id, request_id, client_id, professional_id, status, deposit_amount, is_remunerable, deposit_payment_intent_id",
      )
      .eq("id", onsiteId)
      .single();
    if (onsiteError || !onsiteRow) {
      return NextResponse.json(
        { error: "ONSITE_REQUEST_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    const onsite = onsiteRow as OnsiteRow;
    if (!onsite.client_id || onsite.client_id !== userId) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    if ((onsite.status || "").toLowerCase() !== "deposit_pending") {
      return NextResponse.json(
        { error: "INVALID_STATUS" },
        { status: 409, headers: JSONH },
      );
    }

    const mode = await resolveStripeModeForRequestUser(routeClient);
    const stripe = await getStripeForMode(mode);
    if (!stripe) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:STRIPE_SECRET_KEY" },
        { status: 500, headers: JSONH },
      );
    }
    const publishableKey = getPublishableKeyForMode(mode);
    if (!publishableKey) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:STRIPE_PUBLISHABLE_KEY" },
        { status: 500, headers: JSONH },
      );
    }

    const onsiteAmount = Number(onsite.deposit_amount ?? NaN);
    if (!Number.isFinite(onsiteAmount) || onsiteAmount <= 0) {
      return NextResponse.json(
        { error: "INVALID_DEPOSIT_AMOUNT" },
        { status: 400, headers: JSONH },
      );
    }
    const { baseCents, feeCents, ivaCents, totalCents } =
      computeClientTotalsCents(
        Math.max(0, Math.round(Math.abs(onsiteAmount) * 100)) / 100,
      );
    const amountCents = Math.max(200, totalCents);

    const metadata: Record<string, string> = {
      type: "onsite_deposit",
      onsite_quote_request_id: onsite.id,
      onsite_request_id: onsite.id,
      conversation_id: onsite.conversation_id || "",
      request_id: onsite.request_id || "",
      is_remunerable: onsite.is_remunerable ? "true" : "false",
      base_cents: String(baseCents),
      commission_cents: String(feeCents),
      iva_cents: String(ivaCents),
      total_cents: String(amountCents),
      deposit_base_cents: String(baseCents),
      deposit_fee_cents: String(feeCents),
      deposit_iva_cents: String(ivaCents),
      deposit_total_cents: String(amountCents),
      proId: onsite.professional_id || "",
      payment_mode: mode,
    };

    let intentId: string | null = onsite.deposit_payment_intent_id;
    let paymentIntent: Awaited<
      ReturnType<typeof stripe.paymentIntents.retrieve>
    > | null = null;

    if (intentId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(intentId);
        const reusableStatuses = [
          "requires_payment_method",
          "requires_confirmation",
          "requires_action",
          "processing",
          "requires_capture",
        ];
        if (
          existing &&
          reusableStatuses.includes(existing.status) &&
          Number(existing.amount) === amountCents &&
          String(existing.currency).toLowerCase() === "mxn"
        ) {
          paymentIntent = existing;
        } else {
          intentId = null;
        }
      } catch {
        intentId = null;
      }
    }

    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "mxn",
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        description: "Cotización en sitio",
        metadata,
      });
      intentId = paymentIntent.id;
    } else {
      try {
        await stripe.paymentIntents.update(paymentIntent.id, { metadata });
      } catch {
        /* ignore metadata refresh */
      }
    }

    if (intentId) {
      await supabase
        .from("onsite_quote_requests")
        .update({
          deposit_payment_intent_id: intentId,
          deposit_base_cents: baseCents,
          deposit_fee_cents: feeCents,
          deposit_iva_cents: ivaCents,
          deposit_total_cents: amountCents,
        })
        .eq("id", onsite.id);
    }

    const clientSecret = paymentIntent.client_secret || null;
    if (!clientSecret) {
      return NextResponse.json(
        { error: "INTENT_WITHOUT_CLIENT_SECRET" },
        { status: 500, headers: JSONH },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        clientSecret,
        paymentIntentId: intentId,
        publishableKey,
        paymentMode: mode === "test" ? "test" : undefined,
        currency: "MXN",
        isRemunerable: onsite.is_remunerable === true,
        breakdown: {
          service: baseCents / 100,
          fee: feeCents / 100,
          iva: ivaCents / 100,
          total: amountCents / 100,
        },
      },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
