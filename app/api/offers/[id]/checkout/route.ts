import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { computeClientTotalsCents } from "@/lib/payments/fees";
import { getRouteClient } from "@/lib/supabase/route-client";
import { getStripe } from "@/lib/stripe";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

type OfferRow = {
  id: string;
  status: string;
  checkout_url: string | null;
  amount: number | null;
  currency: string | null;
  title: string | null;
  description: string | null;
  conversation_id: string | null;
  client_id: string | null;
};

type ConversationRow = {
  id: string;
  request_id: string | null;
};

type OnsiteEligibleRow = {
  id: string;
  request_id: string | null;
  deposit_amount: number | null;
  deposit_base_cents: number | null;
};

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supaUrl || !serviceRole) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:SUPABASE" },
        { status: 500, headers: JSONH },
      );
    }

    const routeClient = getRouteClient();
    const {
      data: { user },
    } = await routeClient.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      );
    }

    const supabase = createClient<Database>(supaUrl, serviceRole, {
      auth: { persistSession: false },
    });
    const offerId = (params?.id || "").trim();
    if (!offerId) {
      return NextResponse.json(
        { error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );
    }

    const { data: offer, error } = await supabase
      .from("offers")
      .select(
        "id,status,checkout_url,amount,currency,title,description,conversation_id,client_id",
      )
      .eq("id", offerId)
      .single();
    if (error || !offer) {
      return NextResponse.json(
        { error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const row = offer as OfferRow;
    if (!row.client_id || row.client_id !== user.id) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }
    if (row.checkout_url) {
      return NextResponse.json(
        { ok: true, checkoutUrl: row.checkout_url },
        { status: 200, headers: JSONH },
      );
    }

    // Solo generar checkout para ofertas aceptadas
    if (String(row.status).toLowerCase() !== "accepted") {
      return NextResponse.json(
        { error: "INVALID_STATUS" },
        { status: 409, headers: JSONH },
      );
    }

    const stripe = await getStripe();
    if (!stripe) {
      // Stripe no configurado: retorna sin URL, no es error
      return NextResponse.json(
        { ok: true, checkoutUrl: null },
        { status: 200, headers: JSONH },
      );
    }

    const amount = Number(row.amount ?? NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "INVALID_AMOUNT" },
        { status: 400, headers: JSONH },
      );
    }

    let requestId: string | null = null;
    if (row.conversation_id) {
      const { data: conversationRow } = await supabase
        .from("conversations")
        .select("id, request_id")
        .eq("id", row.conversation_id)
        .maybeSingle();
      const conversation = (conversationRow ?? null) as ConversationRow | null;
      requestId = conversation?.request_id ?? null;
    }

    const originalBaseCents = Math.round(amount * 100);
    let onsiteCreditBaseCents = 0;
    let onsiteEligibleId: string | null = null;
    if (row.conversation_id) {
      let onsiteQuery = supabase
        .from("onsite_quote_requests")
        .select(
          "id, request_id, deposit_amount, deposit_base_cents, deposit_paid_at, created_at",
        )
        .eq("conversation_id", row.conversation_id)
        .eq("status", "deposit_paid")
        .eq("is_remunerable", true)
        .is("remuneration_applied_at", null)
        .order("deposit_paid_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (requestId) onsiteQuery = onsiteQuery.eq("request_id", requestId);
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
    }
    onsiteCreditBaseCents = Math.max(
      0,
      Math.min(originalBaseCents, onsiteCreditBaseCents),
    );
    const adjustedBaseCents = Math.max(
      0,
      originalBaseCents - onsiteCreditBaseCents,
    );
    const { feeCents, ivaCents, totalCents } = computeClientTotalsCents(
      adjustedBaseCents / 100,
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${APP_URL.replace(/\/$/, "")}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL.replace(/\/$/, "")}/payments/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (row.currency || "MXN").toLowerCase(),
            unit_amount: totalCents,
            product_data: {
              name: row.title || "Servicio",
              description: row.description || undefined,
            },
          },
        },
      ],
      metadata: {
        type: "offer_payment",
        offer_id: row.id,
        conversation_id: row.conversation_id || "",
        request_id: requestId || "",
        original_base_cents: String(originalBaseCents),
        onsite_credit_base_cents: String(onsiteCreditBaseCents),
        adjusted_base_cents: String(adjustedBaseCents),
        base_cents: String(adjustedBaseCents),
        commission_cents: String(feeCents),
        iva_cents: String(ivaCents),
        total_cents: String(totalCents),
        ...(onsiteEligibleId ? { onsite_request_id: onsiteEligibleId } : {}),
      },
    });

    const checkoutUrl = session.url || null;
    if (checkoutUrl) {
      await supabase
        .from("offers")
        .update({ checkout_url: checkoutUrl })
        .eq("id", row.id);
    }

    return NextResponse.json(
      {
        ok: true,
        checkoutUrl,
        breakdown: {
          originalServiceBase: originalBaseCents / 100,
          onsiteCredit: onsiteCreditBaseCents / 100,
          adjustedServiceBase: adjustedBaseCents / 100,
          fee: feeCents / 100,
          iva: ivaCents / 100,
          total: totalCents / 100,
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
