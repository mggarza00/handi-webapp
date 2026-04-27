import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { computeClientTotalsCents } from "@/lib/payments/fees";
import getRouteClient from "@/lib/supabase/route-client";
import { getStripe } from "@/lib/stripe";
import type { Database } from "@/types/supabase";

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

type OnsiteRow = {
  id: string;
  conversation_id: string | null;
  request_id: string | null;
  client_id: string | null;
  is_remunerable: boolean | null;
  status: string;
  deposit_amount: number | null;
  deposit_checkout_url: string | null;
  deposit_base_cents: number | null;
  deposit_fee_cents: number | null;
  deposit_iva_cents: number | null;
  deposit_total_cents: number | null;
};

type ConversationRow = {
  id: string;
  customer_id: string | null;
  pro_id: string | null;
};

const DEBUG_ONSITE_PAYMENT = process.env.DEBUG_ONSITE_PAYMENT === "1";

function logOnsitePayment(stage: string, data: Record<string, unknown>) {
  if (!DEBUG_ONSITE_PAYMENT) return;
  console.info(`[onsite-payment] ${JSON.stringify({ stage, ...data })}`);
}

export async function POST(
  req: Request,
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
    const rowId = (params?.id || "").trim();
    if (!rowId) {
      return NextResponse.json(
        { error: "MISSING_ID" },
        { status: 400, headers: JSONH },
      );
    }

    const { data: onsite, error } = await supabase
      .from("onsite_quote_requests")
      .select(
        "id, conversation_id, request_id, client_id, is_remunerable, status, deposit_amount, deposit_checkout_url, deposit_base_cents, deposit_fee_cents, deposit_iva_cents, deposit_total_cents",
      )
      .eq("id", rowId)
      .single();
    if (error || !onsite) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }

    const row = onsite as OnsiteRow;
    const { data: conversationRow, error: conversationError } =
      row.conversation_id
        ? await supabase
            .from("conversations")
            .select("id, customer_id, pro_id")
            .eq("id", row.conversation_id)
            .single()
        : { data: null, error: null };
    if (conversationError) {
      return NextResponse.json(
        { error: "ONSITE_CONVERSATION_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    }
    const conversation = (conversationRow ?? null) as ConversationRow | null;
    if (!conversation?.customer_id || conversation.customer_id !== user.id) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );
    }

    const validStoredCheckout = normalizeCheckoutUrl(row.deposit_checkout_url);
    if (validStoredCheckout) {
      return NextResponse.json(
        { ok: true, checkoutUrl: validStoredCheckout },
        { status: 200, headers: JSONH },
      );
    }
    if (row.deposit_checkout_url) {
      await supabase
        .from("onsite_quote_requests")
        .update({ deposit_checkout_url: null })
        .eq("id", row.id);
    }

    if ((row.status || "").toLowerCase() !== "deposit_pending") {
      return NextResponse.json(
        { error: "INVALID_STATUS" },
        { status: 409, headers: JSONH },
      );
    }

    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: true, checkoutUrl: null },
        { status: 200, headers: JSONH },
      );
    }

    const baseAmountMx = Number(row.deposit_amount ?? 200);
    const safeAmount =
      Math.max(0, Math.round(Math.abs(baseAmountMx) * 100)) / 100;
    const { baseCents, feeCents, ivaCents, totalCents } =
      computeClientTotalsCents(safeAmount);
    const unitAmount = Math.max(200, totalCents);

    const appBaseUrl = resolveAppBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${appBaseUrl}/mensajes/${encodeURIComponent(row.conversation_id || "")}?status=deposit_success`,
      cancel_url: `${appBaseUrl}/mensajes/${encodeURIComponent(row.conversation_id || "")}?status=deposit_cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: unitAmount,
            product_data: { name: "Cotización en sitio" },
          },
        },
      ],
      metadata: {
        type: "onsite_deposit",
        onsite_quote_request_id: row.id,
        onsite_request_id: row.id,
        conversation_id: row.conversation_id || "",
        conversationId: row.conversation_id || "",
        request_id: row.request_id || "",
        requestId: row.request_id || "",
        is_remunerable: row.is_remunerable ? "true" : "false",
        deposit_base_cents: String(baseCents),
        deposit_fee_cents: String(feeCents),
        deposit_iva_cents: String(ivaCents),
        deposit_total_cents: String(unitAmount),
        base_cents: String(baseCents),
        commission_cents: String(feeCents),
        iva_cents: String(ivaCents),
        total_cents: String(unitAmount),
        professional_id: conversation?.pro_id || "",
        professionalId: conversation?.pro_id || "",
        client_id: conversation?.customer_id || "",
        clientId: conversation?.customer_id || "",
      },
    });
    logOnsitePayment("checkout.metadata", {
      onsiteRequestId: row.id,
      conversationId: row.conversation_id ?? null,
      requestId: row.request_id ?? null,
      customerId: conversation?.customer_id ?? null,
      professionalId: conversation?.pro_id ?? null,
      status: row.status,
      checkoutSessionId: session.id,
      metadata: session.metadata ?? null,
    });

    const checkoutUrl = normalizeCheckoutUrl(session.url || null);
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: "CHECKOUT_URL_INVALID" },
        { status: 502, headers: JSONH },
      );
    }
    if (checkoutUrl) {
      await supabase
        .from("onsite_quote_requests")
        .update({
          deposit_checkout_url: checkoutUrl,
          deposit_base_cents: row.deposit_base_cents ?? baseCents,
          deposit_fee_cents: row.deposit_fee_cents ?? feeCents,
          deposit_iva_cents: row.deposit_iva_cents ?? ivaCents,
          deposit_total_cents: row.deposit_total_cents ?? unitAmount,
        })
        .eq("id", row.id);
    }

    return NextResponse.json(
      { ok: true, checkoutUrl },
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
