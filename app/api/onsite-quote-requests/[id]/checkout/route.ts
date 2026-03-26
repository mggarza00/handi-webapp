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
    if (!row.client_id || row.client_id !== user.id) {
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
        request_id: row.request_id || "",
        is_remunerable: row.is_remunerable ? "true" : "false",
        deposit_base_cents: String(baseCents),
        deposit_fee_cents: String(feeCents),
        deposit_iva_cents: String(ivaCents),
        deposit_total_cents: String(unitAmount),
        base_cents: String(baseCents),
        commission_cents: String(feeCents),
        iva_cents: String(ivaCents),
        total_cents: String(unitAmount),
      },
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
