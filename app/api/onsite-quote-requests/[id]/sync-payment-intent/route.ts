import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { finalizeOnsiteDepositPayment } from "@/lib/payments/finalize-onsite-deposit-payment";
import { getRouteClient } from "@/lib/supabase/route-client";
import { getStripeForMode, type StripeMode } from "@/lib/stripe";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const DEBUG_ONSITE_PAYMENT = process.env.DEBUG_ONSITE_PAYMENT === "1";

type OnsiteRow = {
  id: string;
  status: string;
  conversation_id: string | null;
  request_id: string | null;
  deposit_payment_intent_id: string | null;
};

type ConversationRow = {
  id: string;
  customer_id: string | null;
  pro_id: string | null;
};

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function logOnsitePayment(stage: string, data: Record<string, unknown>) {
  if (!DEBUG_ONSITE_PAYMENT) return;
  console.info(`[onsite-payment] ${JSON.stringify({ stage, ...data })}`);
}

function isMissingPaymentIntent(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code || "";
  if (code === "resource_missing") return true;
  const message = err instanceof Error ? err.message : "";
  return message.includes("No such payment_intent");
}

export async function POST(
  req: Request,
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

    const onsiteRequestId = (params?.id || "").trim();
    if (!onsiteRequestId) {
      return NextResponse.json(
        { error: "MISSING_ONSITE_REQUEST" },
        { status: 400, headers: JSONH },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      paymentIntentId?: string | null;
    };
    const requestedPiId =
      typeof body.paymentIntentId === "string" && body.paymentIntentId.trim()
        ? body.paymentIntentId.trim()
        : null;

    const routeClient = getRouteClient();
    const {
      data: { user },
    } = await routeClient.auth.getUser();
    if (!user?.id) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const onsiteSelect = await supabase
      .from("onsite_quote_requests")
      .select(
        "id, status, conversation_id, request_id, deposit_payment_intent_id",
      )
      .eq("id", onsiteRequestId)
      .single();
    if (onsiteSelect.error || !onsiteSelect.data) {
      return NextResponse.json(
        { error: "ONSITE_REQUEST_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    const onsite = onsiteSelect.data as OnsiteRow;

    const conversationSelect = onsite.conversation_id
      ? await supabase
          .from("conversations")
          .select("id, customer_id, pro_id")
          .eq("id", onsite.conversation_id)
          .single()
      : { data: null, error: null };
    if (conversationSelect.error || !conversationSelect.data) {
      return NextResponse.json(
        { error: "ONSITE_CONVERSATION_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    const conversation = conversationSelect.data as ConversationRow;
    if (
      user.id !== conversation.customer_id &&
      user.id !== conversation.pro_id
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const paymentIntentId = requestedPiId || onsite.deposit_payment_intent_id;
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "MISSING_PAYMENT_INTENT" },
        { status: 400, headers: JSONH },
      );
    }

    let mode: StripeMode = "live";
    let stripe = await getStripeForMode(mode);
    if (!stripe) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:STRIPE" },
        { status: 500, headers: JSONH },
      );
    }

    let paymentIntent: Awaited<
      ReturnType<typeof stripe.paymentIntents.retrieve>
    >;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
    } catch (err) {
      if (!isMissingPaymentIntent(err)) throw err;
      const fallbackMode: StripeMode = "test";
      const fallbackStripe = await getStripeForMode(fallbackMode);
      if (!fallbackStripe) throw err;
      paymentIntent = await fallbackStripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        },
      );
      mode = fallbackMode;
      stripe = fallbackStripe;
    }

    logOnsitePayment("sync.retrieve-payment-intent", {
      onsiteRequestId,
      paymentIntentId,
      mode,
      stripeStatus: paymentIntent.status,
      metadata: paymentIntent.metadata ?? null,
    });

    if (
      paymentIntent.status !== "succeeded" &&
      paymentIntent.status !== "requires_capture"
    ) {
      return NextResponse.json(
        { error: "PAYMENT_NOT_CONFIRMED", status: paymentIntent.status },
        { status: 409, headers: JSONH },
      );
    }

    const finalized = await finalizeOnsiteDepositPayment({
      onsiteRequestId,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata as Record<string, unknown>,
      amountTotalCents:
        typeof paymentIntent.amount_received === "number" &&
        Number.isFinite(paymentIntent.amount_received)
          ? paymentIntent.amount_received
          : typeof paymentIntent.amount === "number" &&
              Number.isFinite(paymentIntent.amount)
            ? paymentIntent.amount
            : null,
      source: "sync",
      admin: supabase as never,
    });

    logOnsitePayment("sync.finalize-result", {
      onsiteRequestId,
      paymentIntentId: paymentIntent.id,
      result: finalized,
    });

    return NextResponse.json(
      {
        ok: finalized.ok,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        onsiteStatus:
          finalized.updated || finalized.alreadyPaid
            ? "deposit_paid"
            : onsite.status,
      },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    logOnsitePayment("sync.error", {
      error: message,
    });
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
