import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import { createServerClient } from "@/lib/supabase";

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
type OfferSummary = Pick<OfferRow, "id" | "status" | "professional_id">;
// accepting_at puede no existir en algunos esquemas; evitar usarlo directamente
// Note: OfferLockFields not used after removing locking logic
type MessageRow = {
  payload: unknown;
  message_type: string | null;
  created_at: string | null;
};

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let stripeSession: Stripe.Checkout.Session | null = null;
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
    const stripe = stripeConfigured
      ? new Stripe(STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"] })
      : null;

    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { data: auth } = await supabase.auth.getUser();
    const actingUserId = auth?.user?.id || null;
    if (!actingUserId)
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1" || url.searchParams.get("probe") === "1";
    const conversationId = params.id;
    if (!conversationId)
      return NextResponse.json({ error: "MISSING_CONVERSATION" }, { status: 400, headers: JSONH });

    // Get latest offers and pick first 'pending' in app logic (avoids enum/string mismatch edge cases)
    const admin = createServerClient();
    const { data: recentRows } = await admin
      .from("offers")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);
    const offerRows = (recentRows ?? []) as OfferRow[];
    let target: OfferRow | null = null;
    if (offerRows.length) {
      target =
        offerRows.find((r) => String(r.status).trim().toLowerCase() === "pending") ??
        offerRows[0] ??
        null;
    }
    if (debug) {
      return NextResponse.json(
        {
          ok: true,
          actingUserId,
          conversationId,
          recent: offerRows.map<OfferSummary>((r) => ({ id: r.id, status: r.status, professional_id: r.professional_id })),
          chosen: target ? { id: target.id, status: target.status, professional_id: target.professional_id } : null,
        },
        { status: 200, headers: JSONH },
      );
    }
    if (!target) {
      // Fallback: scan recent messages for last offer_id and validate it exists and is 'pending'
      const { data: msgs } = await admin
        .from("messages")
        .select("payload, message_type, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(100);
      const seen = new Set<string>();
      const messages = (msgs ?? []) as MessageRow[];
      if (messages.length) {
        for (const message of messages) {
          const type = message.message_type ?? null;
          const rawPayload = message.payload;
          let parsedPayload: unknown = rawPayload;
          if (typeof rawPayload === "string") {
            try {
              parsedPayload = JSON.parse(rawPayload);
            } catch {
              parsedPayload = null;
            }
          }
          let oid: string | null = null;
          const payloadObject =
            parsedPayload && typeof parsedPayload === "object"
              ? (parsedPayload as Record<string, unknown>)
              : null;
          if (payloadObject && type && (type === "offer" || type === "system")) {
            const offerIdRaw = (payloadObject as { offer_id?: unknown }).offer_id;
            if (typeof offerIdRaw === "string" && offerIdRaw) oid = offerIdRaw;
          }
          if (oid && !seen.has(oid)) {
            seen.add(oid);
            const { data: row } = await admin.from("offers").select("*").eq("id", oid).maybeSingle();
            if (row && row.status === "pending") {
              target = row as OfferRow;
              break;
            }
          }
        }
        // If still not found, try to reconstruct offer from last 'offer' message and insert as pending (service role)
        if (!target) {
          const lastOfferMsg = messages.find((m) => (m.message_type ?? null) === "offer");
          if (lastOfferMsg) {
            let p: unknown = lastOfferMsg.payload;
            if (typeof p === "string") { try { p = JSON.parse(p); } catch { p = null; } }
            const payloadObj = p && typeof p === "object" ? (p as Record<string, unknown>) : null;
            if (payloadObj) {
              const { data: convoRow } = await admin
                .from("conversations")
                .select("customer_id, pro_id")
                .eq("id", conversationId)
                .maybeSingle();
              const customerId = (convoRow as { customer_id?: string } | null)?.customer_id ?? null;
              const proId = (convoRow as { pro_id?: string } | null)?.pro_id ?? null;
              // ensure actor matches pro
              if (customerId && proId && proId === actingUserId) {
                const amountRaw = payloadObj["amount"] as unknown;
                const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw ?? NaN);
                const currencyRaw = payloadObj["currency"] as unknown;
                const currency = typeof currencyRaw === "string" && currencyRaw.trim().length ? currencyRaw.toUpperCase() : "MXN";
                const titleRaw = payloadObj["title"] as unknown;
                const title = typeof titleRaw === "string" && titleRaw.trim().length ? titleRaw : "Oferta";
                const descRaw = payloadObj["description"] as unknown;
                const description = typeof descRaw === "string" && descRaw.trim().length ? descRaw : null;
                const sdRaw = payloadObj["service_date"] as unknown;
                const service_date = typeof sdRaw === "string" && sdRaw.trim().length ? new Date(sdRaw).toISOString() : null;
                if (Number.isFinite(amount) && amount > 0) {
                  const { data: created } = await admin
                    .from("offers")
                    .insert({
                      conversation_id: conversationId,
                      client_id: customerId,
                      professional_id: proId,
                      title,
                      description,
                      currency,
                      amount: Math.round((Number(amount) + Number.EPSILON) * 100) / 100,
                      service_date,
                      created_by: customerId,
                      metadata: {},
                    })
                    .select("*")
                    .single();
                  if (created) {
                    target = created as OfferRow;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!target)
      return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (target.professional_id !== actingUserId)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    // Direct accept without lock (for environments without 'accepting_at')
    if (stripe) {
      try {
        // Compute total: service amount + commission + IVA
        const baseAmount = Number(target.amount ?? NaN);
        const fee = Number.isFinite(baseAmount) && baseAmount > 0
          ? Math.min(1500, Math.max(50, Math.round((baseAmount * 0.05 + Number.EPSILON) * 100) / 100))
          : 0;
        const iva = Number.isFinite(baseAmount)
          ? Math.round((((baseAmount + fee) * 0.16) + Number.EPSILON) * 100) / 100
          : 0;
        const total = Number.isFinite(baseAmount) ? baseAmount + fee + iva : 0;
        stripeSession = await stripe.checkout.sessions.create({
          mode: "payment",
          success_url: `${APP_URL}/offers/${target.id}?status=success`,
          cancel_url: `${APP_URL}/offers/${target.id}?status=cancel`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: (target.currency || "MXN").toLowerCase(),
                unit_amount: Math.round(total * 100),
                product_data: { name: target.title, description: target.description || undefined },
              },
            },
          ],
          metadata: { offer_id: target.id, conversation_id: target.conversation_id },
        });
      } catch {
        // ignore: stripe fallback; acceptance can proceed without checkout_url
      }
    }

    const { data: updatedRows, error: upErr } = await admin
      .from("offers")
      .update({ status: "accepted", checkout_url: stripeSession?.url ?? null })
      .eq("id", target.id)
      .select("*");

    if (upErr) return NextResponse.json({ error: upErr.message || "UPDATE_FAILED" }, { status: 409, headers: JSONH });
    const updated = (Array.isArray(updatedRows) ? updatedRows[0] : (updatedRows as OfferRow | null)) ?? null;
    if (!updated)
      return NextResponse.json({ error: "UPDATE_NO_ROWS" }, { status: 409, headers: JSONH });

    if (stripeSession && stripeSession.url) {
      await fetch(`${APP_URL}/api/notify/offer-accepted`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ offerId: target.id }),
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, offer: updated, checkoutUrl: stripeSession?.url ?? null }, { status: 200, headers: JSONH });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: 500, headers: JSONH });
  }
}

// Debug-friendly GET: returns diagnostic info without changing state
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const probe = url.searchParams.get("debug") === "1" || url.searchParams.get("probe") === "1";
    const conversationId = params.id;
    if (!conversationId) return NextResponse.json({ ok: false, error: "MISSING_CONVERSATION" }, { status: 400, headers: JSONH });
    const admin = createServerClient();
    const { data: recentRows } = await admin
      .from("offers")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);
    const offerRows = (recentRows ?? []) as OfferRow[];
    const chosen = offerRows.find((r) => String(r.status).trim().toLowerCase() === "pending") ?? offerRows[0] ?? null;
    if (!probe) {
      return NextResponse.json({ ok: true, conversationId, recent: offerRows.map<OfferSummary>((r) => ({ id: r.id, status: r.status, professional_id: r.professional_id })), chosen: chosen ? { id: chosen.id, status: chosen.status, professional_id: chosen.professional_id } : null }, { status: 200, headers: JSONH });
    }
    const { data: msgs } = await admin
      .from("messages")
      .select("payload, message_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(50);
    let lastOffer: { offer_id?: string | null; title?: string | null; amount?: number | null; currency?: string | null } | null = null;
    if (Array.isArray(msgs)) {
      for (const m of msgs as MessageRow[]) {
        if ((m.message_type ?? null) === "offer") {
          let p: unknown = m.payload;
          if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
          const po = p && typeof p === 'object' ? (p as Record<string, unknown>) : null;
          if (po) {
            const oid = typeof po.offer_id === 'string' ? po.offer_id : null;
            const title = typeof po.title === 'string' ? po.title : null;
            const amount = typeof po.amount === 'number' ? po.amount : (po.amount != null ? Number(po.amount) : null);
            const currency = typeof po.currency === 'string' ? String(po.currency).toUpperCase() : null;
            lastOffer = { offer_id: oid, title, amount: Number.isFinite(amount as number) ? (amount as number) : null, currency };
            break;
          }
        }
      }
    }
    return NextResponse.json({ ok: true, conversationId, recent: offerRows.map<OfferSummary>((r) => ({ id: r.id, status: r.status, professional_id: r.professional_id })), chosen: chosen ? { id: chosen.id, status: chosen.status, professional_id: chosen.professional_id } : null, lastOffer }, { status: 200, headers: JSONH });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: JSONH });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
