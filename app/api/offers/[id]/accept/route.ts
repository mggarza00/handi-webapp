import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { createClient as createSSRClient } from "@/utils/supabase/server";

import { createBearerClient, createServerClient } from "@/lib/supabase";
import { assertRateLimit } from "@/lib/rate/limit";
import { syncOfferAgreementStatus } from "@/lib/agreements/sync-offer-agreement";
import type { Database } from "@/types/supabase";

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let stripeSession: Stripe.Checkout.Session | null = null;
  try {
    const stripe = await getStripe();

    // Resolve acting user (prefer bearer token, fallback cookie, finally x-user-id for dev)
    const supabase = createSSRClient();
    let actingUserId: string | null = null;
    const authHeader = (
      req.headers.get("authorization") ||
      req.headers.get("Authorization") ||
      ""
    ).trim();
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token =
      bearerMatch?.[1] || (req.headers.get("x-access-token") || "").trim();
    if (token) {
      try {
        const bearer = createBearerClient(token);
        const { data, error } = await bearer.auth.getUser(token);
        if (!error && data?.user) actingUserId = data.user.id;
      } catch {
        // ignore bearer failures
      }
    }
    if (!actingUserId) {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) actingUserId = data.user.id;
    }
    if (!actingUserId) {
      const xuid = (req.headers.get("x-user-id") || "").trim();
      if (xuid) actingUserId = xuid;
    }
    if (!actingUserId)
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    // Rate limit best-effort: skip if unauthenticated via cookie (dev headers/bearer may be used)
    try {
      const rate = await assertRateLimit("offer.accept", 30, 3);
      if (!rate.ok)
        return NextResponse.json(
          { error: "RATE_LIMIT", message: rate.message },
          { status: rate.status, headers: JSONH },
        );
    } catch {
      // ignore UNAUTHENTICATED from assertRateLimit when using x-user-id/bearer in dev
    }

    // Use transactional RPC to accept atomically with all guards inside
    const offerId = params.id;
    if (!offerId)
      return NextResponse.json(
        { error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );

    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      "accept_offer_tx",
      { p_offer_id: offerId, p_actor: actingUserId },
    );
    if (rpcErr) {
      const msg = String(rpcErr.message || "");
      const missingFn =
        /could not find the function/i.test(msg) || /schema cache/i.test(msg);
      const mentionsAcceptTx = /accept_offer_tx/i.test(msg);
      if (missingFn && mentionsAcceptTx) {
        // Fallback path when RPC isn't available: emulate accept logic for this offer id
        const admin = createServerClient();
        let row: OfferRow | null = null;
        {
          const { data: target, error: fetchErr } = await admin
            .from("offers")
            .select("*")
            .eq("id", offerId)
            .maybeSingle();
          if (!fetchErr && target) row = target as OfferRow;
        }
        // Fallback: algunos mensajes pueden traer un offer_id que no corresponde al row.id; intenta resolver por mensajes -> conversacion -> oferta pending
        if (!row) {
          const { data: msgRow } = await admin
            .from("messages")
            .select("conversation_id")
            .contains("payload", { offer_id: offerId })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const conversationId =
            (msgRow as { conversation_id?: string } | null)?.conversation_id ??
            null;
          if (conversationId) {
            const { data: offersList } = await admin
              .from("offers")
              .select("*")
              .eq("conversation_id", conversationId)
              .in("status", ["pending", "sent"]) // legacy support
              .order("created_at", { ascending: false })
              .limit(1);
            const candidate =
              Array.isArray(offersList) && offersList.length
                ? (offersList[0] as OfferRow)
                : null;
            row = candidate;
          }
        }
        if (!row)
          return NextResponse.json(
            { error: "OFFER_NOT_FOUND" },
            { status: 404, headers: JSONH },
          );
        if (row.professional_id !== actingUserId)
          return NextResponse.json(
            { error: "FORBIDDEN" },
            { status: 403, headers: JSONH },
          );
        const normalized = String(row.status).toLowerCase();
        if (!(normalized === "pending" || normalized === "sent"))
          return NextResponse.json(
            { error: "INVALID_STATUS" },
            { status: 409, headers: JSONH },
          );
        // Lock
        const lockTime = new Date().toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lockRes: any = await (admin as any)
          .from("offers")
          .update({ accepting_at: lockTime })
          .eq("id", row.id)
          .is("accepting_at", null)
          .in("status", ["pending", "sent"]) // allow legacy
          .select("*")
          .single();
        const lockErr = lockRes?.error || null;
        const locked = lockRes?.data || null;
        if (lockErr || !locked) {
          // Check if lock is stale or status changed
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const curRes: any = await (admin as any)
            .from("offers")
            .select(
              "id,status,accepting_at,currency,amount,title,description,conversation_id,professional_id",
            )
            .eq("id", row.id)
            .maybeSingle();
          const current = curRes?.data as unknown as { status?: string } | null;
          if (!current)
            return NextResponse.json(
              { error: "OFFER_NOT_FOUND" },
              { status: 404, headers: JSONH },
            );
          const st = String(current.status || "").toLowerCase();
          if (!(st === "pending" || st === "sent"))
            return NextResponse.json(
              { error: "INVALID_STATUS" },
              { status: 409, headers: JSONH },
            );
          // En entornos sin columna 'accepting_at', evitamos lock y procedemos directo a actualizar estado más abajo
        }
        // Stripe session
        if (stripe) {
          try {
            const baseAmount = Number(row.amount ?? NaN);
            const fee =
              Number.isFinite(baseAmount) && baseAmount > 0
                ? Math.min(
                    1500,
                    Math.max(
                      50,
                      Math.round((baseAmount * 0.05 + Number.EPSILON) * 100) /
                        100,
                    ),
                  )
                : 0;
            const iva = Number.isFinite(baseAmount)
              ? Math.round(((baseAmount + fee) * 0.16 + Number.EPSILON) * 100) /
                100
              : 0;
            const total = Number.isFinite(baseAmount)
              ? baseAmount + fee + iva
              : 0;
            stripeSession = await stripe.checkout.sessions.create({
              mode: "payment",
              success_url: `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&cid=${row.conversation_id}`,
              cancel_url: `${APP_URL}/offers/${row.id}?status=cancel`,
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: (row.currency || "MXN").toLowerCase(),
                    unit_amount: Math.round(total * 100),
                    product_data: {
                      name: row.title,
                      description: row.description || undefined,
                    },
                  },
                },
              ],
              metadata: {
                offer_id: row.id,
                conversation_id: row.conversation_id,
              },
            });
          } catch {
            // ignore: proceed without checkout_url
          }
        }
        // Update status to accepted
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const upd2: any = await (admin as any)
          .from("offers")
          .update({
            status: "accepted",
            checkout_url: stripeSession?.url ?? null,
          })
          .eq("id", row.id)
          .select("*");
        const upErr = upd2?.error || null;
        const updatedRows = upd2?.data || null;
        if (upErr)
          return NextResponse.json(
            { error: String(upErr.message || "UPDATE_FAILED") },
            { status: 409, headers: JSONH },
          );
        const updated =
          (Array.isArray(updatedRows)
            ? updatedRows[0]
            : (updatedRows as OfferRow | null)) ?? null;
        if (!updated)
          return NextResponse.json(
            { error: "UPDATE_NO_ROWS" },
            { status: 409, headers: JSONH },
          );
        // Notify
        if (stripeSession && stripeSession.url) {
          await fetch(`${APP_URL}/api/notify/offer-accepted`, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ offerId: row.id }),
          }).catch(() => undefined);
        }
        await syncOfferAgreementStatus({
          offer: updated,
          status: "accepted",
        });
        return NextResponse.json(
          { ok: true, offer: updated, checkoutUrl: stripeSession?.url ?? null },
          { status: 200, headers: JSONH },
        );
      }
      return NextResponse.json(
        { error: rpcErr.message },
        { status: 400, headers: JSONH },
      );
    }
    const ok = Boolean((rpcResult as { ok?: boolean } | null)?.ok);
    const err = String((rpcResult as { error?: string } | null)?.error || "");
    if (!ok) {
      const code = err.toLowerCase();
      if (code === "bank_account_required")
        return NextResponse.json(
          { error: code },
          { status: 409, headers: JSONH },
        );
      if (code === "offer_not_found")
        return NextResponse.json(
          { error: code },
          { status: 404, headers: JSONH },
        );
      if (code === "forbidden")
        return NextResponse.json(
          { error: code },
          { status: 403, headers: JSONH },
        );
      if (code === "invalid_state")
        return NextResponse.json(
          { error: code },
          { status: 409, headers: JSONH },
        );
      return NextResponse.json(
        { error: code || "UNKNOWN" },
        { status: 400, headers: JSONH },
      );
    }

    // No need to parse body context; RPC accepted or returned error

    let offer: OfferRow | null = null;
    {
      const { data } = await supabase
        .from("offers")
        .select("*")
        .eq("id", offerId)
        .maybeSingle();
      offer = (data as OfferRow | null) ?? null;
    }
    // After RPC success, we expect the target offer to exist and be accepted
    if (!offer)
      return NextResponse.json(
        { error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );

    // No locking dance required; RPC already accepted atomically

    if (stripe && offer) {
      stripeSession = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&cid=${offer.conversation_id}`,
        cancel_url: `${APP_URL}/offers/${offer.id}?status=cancel`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (offer.currency || "MXN").toLowerCase(),
              unit_amount: Math.round(Number(offer.amount) * 100),
              product_data: {
                name: offer.title,
                description: offer.description || undefined,
              },
            },
          },
        ],
        metadata: {
          offer_id: offer.id,
          conversation_id: offer.conversation_id,
        },
      });
    }
    // Update checkout_url only (status already accepted by RPC)
    let updated: OfferRow | null = offer;
    if (stripeSession?.url) {
      const { data: upd } = await supabase
        .from("offers")
        .update({ checkout_url: stripeSession.url })
        .eq("id", offer.id)
        .select("*")
        .single();
      if (upd) updated = upd as OfferRow;
    }

    if (stripeSession && stripeSession.url) {
      await fetch(`${APP_URL}/api/notify/offer-accepted`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ offerId: offer.id }),
      }).catch(() => undefined);
    }

    try {
      const admin = createServerClient();
      await syncOfferAgreementStatus({
        offer: (updated ?? offer) as OfferRow,
        status: "accepted",
      });
    } catch {
      /* ignore sync errors */
    }

    return NextResponse.json(
      { ok: true, offer: updated, checkoutUrl: stripeSession?.url ?? null },
      { status: 200, headers: JSONH },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
