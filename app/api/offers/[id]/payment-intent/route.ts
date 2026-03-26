import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublishableKeyForMode, getStripeForMode } from "@/lib/stripe";
import { computeClientTotalsCents } from "@/lib/payments/fees";
import type { Database } from "@/types/supabase";
import { resolveStripeModeForRequestUser } from "@/lib/payments/stripe-mode";
import { getRouteClient } from "@/lib/supabase/route-client";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type OfferRow = {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  title: string | null;
  description: string | null;
  conversation_id: string | null;
  payment_intent_id: string | null;
  client_id: string | null;
  payment_mode: string | null;
};

type ConversationRow = {
  id: string;
  request_id: string | null;
  customer_id: string | null;
  pro_id: string | null;
};

type OnsiteEligibleRow = {
  id: string;
  conversation_id: string | null;
  request_id: string | null;
  status: string;
  is_remunerable: boolean | null;
  remuneration_applied_at: string | null;
  remuneration_applied_offer_id: string | null;
  deposit_amount: number | null;
  deposit_base_cents: number | null;
  deposit_paid_at: string | null;
  created_at: string | null;
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

    const offerId = (params?.id || "").trim();
    if (!offerId) {
      return NextResponse.json(
        { error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );
    }

    const routeClient = getRouteClient();
    const { data: userData } = await routeClient.auth.getUser();
    const userId = userData?.user?.id || null;
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const { data: offerRow, error: offerErr } = await supabase
      .from("offers")
      .select(
        "id,status,amount,currency,title,description,conversation_id,payment_intent_id,client_id,payment_mode",
      )
      .eq("id", offerId)
      .single();
    if (offerErr || !offerRow) {
      return NextResponse.json(
        { error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    const offer = offerRow as OfferRow;
    if (!offer.client_id || offer.client_id !== userId) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    if (String(offer.status).toLowerCase() !== "accepted") {
      return NextResponse.json(
        { error: "INVALID_STATUS" },
        { status: 409, headers: JSONH },
      );
    }

    const amount = Number(offer.amount ?? NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "INVALID_AMOUNT" },
        { status: 400, headers: JSONH },
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

    let conversation: ConversationRow | null = null;
    if (offer.conversation_id) {
      try {
        const { data: convRow } = await supabase
          .from("conversations")
          .select("id,request_id,customer_id,pro_id")
          .eq("id", offer.conversation_id)
          .maybeSingle();
        if (convRow) {
          conversation = convRow as ConversationRow;
        }
      } catch {
        /* ignore */
      }
    }

    const originalBaseCents = Math.round(amount * 100);
    let onsiteCreditBaseCents = 0;
    let onsiteEligibleId: string | null = null;
    if (offer.conversation_id) {
      try {
        let onsiteQuery = supabase
          .from("onsite_quote_requests")
          .select(
            "id, conversation_id, request_id, status, is_remunerable, remuneration_applied_at, remuneration_applied_offer_id, deposit_amount, deposit_base_cents, deposit_paid_at, created_at",
          )
          .eq("conversation_id", offer.conversation_id)
          .eq("status", "deposit_paid")
          .eq("is_remunerable", true)
          .is("remuneration_applied_at", null)
          .order("deposit_paid_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(5);
        if (conversation?.request_id) {
          onsiteQuery = onsiteQuery.eq("request_id", conversation.request_id);
        }
        const { data: onsiteRows } = await onsiteQuery;
        const onsiteEligible = Array.isArray(onsiteRows)
          ? ((onsiteRows[0] as OnsiteEligibleRow | undefined) ?? null)
          : null;
        if (onsiteEligible?.id) {
          onsiteEligibleId = onsiteEligible.id;
          const storedBaseCents = Number(
            onsiteEligible.deposit_base_cents ?? NaN,
          );
          if (Number.isFinite(storedBaseCents) && storedBaseCents > 0) {
            onsiteCreditBaseCents = Math.round(storedBaseCents);
          } else {
            const fallbackMx = Number(onsiteEligible.deposit_amount ?? NaN);
            if (Number.isFinite(fallbackMx) && fallbackMx > 0) {
              onsiteCreditBaseCents = Math.round(fallbackMx * 100);
            }
          }
        }
      } catch {
        onsiteEligibleId = null;
        onsiteCreditBaseCents = 0;
      }
    }
    onsiteCreditBaseCents = Math.max(
      0,
      Math.min(originalBaseCents, onsiteCreditBaseCents),
    );
    const adjustedBaseCents = Math.max(
      0,
      originalBaseCents - onsiteCreditBaseCents,
    );
    const { baseCents, feeCents, ivaCents, totalCents } =
      computeClientTotalsCents(adjustedBaseCents / 100);
    const currency = (offer.currency || "MXN").toLowerCase();

    const metadata: Record<string, string> = {
      offer_id: offer.id,
      conversation_id: offer.conversation_id || "",
      payment_mode: mode,
      type: "offer_payment",
      base_cents: String(baseCents),
      commission_cents: String(feeCents),
      iva_cents: String(ivaCents),
      total_cents: String(totalCents),
      original_base_cents: String(originalBaseCents),
      onsite_credit_base_cents: String(onsiteCreditBaseCents),
      adjusted_base_cents: String(adjustedBaseCents),
    };
    if (conversation?.request_id) metadata.request_id = conversation.request_id;
    if (conversation?.pro_id) metadata.proId = conversation.pro_id;
    if (onsiteEligibleId) metadata.onsite_request_id = onsiteEligibleId;

    let intentId: string | null = offer.payment_intent_id;
    let paymentIntent: Awaited<
      ReturnType<typeof stripe.paymentIntents.retrieve>
    > | null = null;
    if (intentId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(intentId);
        const acceptable = [
          "requires_payment_method",
          "requires_confirmation",
          "requires_action",
          "processing",
          "requires_capture",
        ];
        if (
          existing &&
          acceptable.includes(existing.status) &&
          Number(existing.amount) === totalCents &&
          String(existing.currency).toLowerCase() === currency
        ) {
          paymentIntent = existing;
        }
      } catch {
        intentId = null;
      }
    }

    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        description: offer.title || "Servicio",
        metadata,
      });
      intentId = paymentIntent.id;
    } else {
      // Keep metadata fresh
      try {
        await stripe.paymentIntents.update(paymentIntent.id, { metadata });
      } catch {
        /* ignore update errors */
      }
    }

    if (intentId) {
      try {
        await supabase
          .from("offers")
          .update({
            payment_intent_id: intentId,
            checkout_url: null,
            payment_mode: mode,
          })
          .eq("id", offer.id);
      } catch {
        /* ignore */
      }
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
        amount: amount,
        currency: offer.currency || "MXN",
        breakdown: {
          service: adjustedBaseCents / 100,
          originalServiceBase: originalBaseCents / 100,
          onsiteCredit: onsiteCreditBaseCents / 100,
          adjustedServiceBase: adjustedBaseCents / 100,
          fee: feeCents / 100,
          iva: ivaCents / 100,
          total: totalCents / 100,
        },
        onsiteCredit: onsiteEligibleId
          ? {
              onsiteRequestId: onsiteEligibleId,
              baseAmount: onsiteCreditBaseCents / 100,
            }
          : null,
        paymentIntentId: intentId,
        publishableKey,
        paymentMode: mode === "test" ? "test" : undefined,
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
