import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { createClient as createSSRClient } from "@/utils/supabase/server";

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
    const stripe = await getStripe();

    const supabase = createSSRClient();
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sel: any = await (admin as any).from("offers").select("*").eq("id", oid).maybeSingle();
            const row = (sel?.data ?? null) as unknown as { status?: string } | null;
            if (row && String(row.status || "").toLowerCase() === "pending") {
              target = (sel.data as unknown) as OfferRow;
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const ins: any = await (admin as any)
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
                  if (ins?.data) {
                    target = ins.data as OfferRow;
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
        // Compute total: servicio + comisión + IVA (work in cents)
        const baseAmount = Number(target.amount ?? NaN);
        const baseCents = Number.isFinite(baseAmount) && baseAmount > 0 ? Math.round(baseAmount * 100) : 0;
        const feeCents = baseCents > 0 ? Math.min(150000, Math.max(5000, Math.round(baseCents * 0.05))) : 0; // 50–1500 MXN
        const ivaCents = baseCents > 0 ? Math.round((baseCents + feeCents) * 0.16) : 0;
        const totalCents = baseCents + feeCents + ivaCents;
      stripeSession = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&cid=${target.conversation_id}`,
        cancel_url: `${APP_URL}/offers/${target.id}?status=cancel`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: (target.currency || "MXN").toLowerCase(),
                unit_amount: totalCents,
                product_data: { name: target.title, description: target.description || undefined },
              },
            },
          ],
          metadata: {
            offer_id: target.id,
            conversation_id: target.conversation_id,
            base_cents: String(baseCents),
            commission_cents: String(feeCents),
            iva_cents: String(ivaCents),
            total_cents: String(totalCents),
          },
        });
      } catch {
        // ignore: stripe fallback; acceptance can proceed without checkout_url
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd: any = await (admin as any)
      .from("offers")
      .update({ status: "accepted", checkout_url: stripeSession?.url ?? null })
      .eq("id", target.id)
      .select("*");
    const upErr = upd?.error || null;
    const updatedRows = upd?.data || null;
    if (upErr) return NextResponse.json({ error: String(upErr.message || "UPDATE_FAILED") }, { status: 409, headers: JSONH });
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
