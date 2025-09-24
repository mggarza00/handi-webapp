import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
type OfferSummary = Pick<OfferRow, "id" | "status" | "professional_id">;
type OfferLockFields = Pick<OfferRow, "id" | "status" | "accepting_at" | "currency" | "amount" | "title" | "description" | "conversation_id" | "professional_id">;
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

    // Get latest offers and pick first 'sent' in app logic (avoids enum/string mismatch edge cases)
    const { data: recentRows } = await supabase
      .from("offers")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);
    const offerRows = (recentRows ?? []) as OfferRow[];
    let target: OfferRow | null = null;
    if (offerRows.length) {
      target =
        offerRows.find((r) => String(r.status).trim().toLowerCase() === "sent") ??
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
      // Fallback: scan recent messages for last offer_id and validate it exists and is 'sent'
      const { data: msgs } = await supabase
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
            const { data: row } = await supabase.from("offers").select("*").eq("id", oid).maybeSingle();
            if (row && row.status === "sent") {
              target = row as OfferRow;
              break;
            }
          }
        }
      }
    }

    if (!target)
      return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (target.professional_id !== actingUserId)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });

    const lockTime = new Date().toISOString();
    const { data: locked, error: lockErr } = await supabase
      .from("offers")
      .update({ accepting_at: lockTime })
      .eq("id", target.id)
      .is("accepting_at", null)
      .eq("status", "sent")
      .select("*")
      .single();
    if (lockErr || !locked) {
      // Check if lock is stale and can be recovered
      const { data: current } = await supabase
        .from("offers")
        .select("id,status,accepting_at,currency,amount,title,description,conversation_id,professional_id")
        .eq("id", target.id)
        .maybeSingle();
      if (!current)
        return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });
      if (current.status !== "sent")
        return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409, headers: JSONH });
      const lockInfo = current as OfferLockFields;
      const accAt = lockInfo.accepting_at || null;
      const staleMs = process.env.NODE_ENV === "production" ? 2 * 60 * 1000 : 15 * 1000; // shorter in dev
      const isStale = accAt ? Date.now() - new Date(accAt).getTime() > staleMs : false;
      // If the lock belongs to the same professional, allow takeover immediately
      if (lockInfo.professional_id === actingUserId && !isStale) {
        const { data: relockSame } = await supabase
          .from("offers")
          .update({ accepting_at: lockTime })
          .eq("id", target.id)
          .eq("status", "sent")
          .select("*")
          .single();
        if (!relockSame) return NextResponse.json({ error: "LOCKED" }, { status: 409, headers: JSONH });
      } else if (isStale) {
        // Reacquire lock overriding stale one
        const { data: relocked } = await supabase
          .from("offers")
          .update({ accepting_at: lockTime })
          .eq("id", target.id)
          .eq("status", "sent")
          .select("*")
          .single();
        if (!relocked) return NextResponse.json({ error: "LOCKED" }, { status: 409, headers: JSONH });
      } else {
        return NextResponse.json({ error: "LOCKED" }, { status: 409, headers: JSONH });
      }
    }

    if (stripe) {
      try {
        stripeSession = await stripe.checkout.sessions.create({
          mode: "payment",
          success_url: `${APP_URL}/offers/${target.id}?status=success`,
          cancel_url: `${APP_URL}/offers/${target.id}?status=cancel`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: (locked.currency || "MXN").toLowerCase(),
                unit_amount: Math.round(Number(locked.amount) * 100),
                product_data: { name: locked.title, description: locked.description || undefined },
              },
            },
          ],
          metadata: { offer_id: locked.id, conversation_id: locked.conversation_id },
        });
      } catch (e) {
        await supabase.from("offers").update({ accepting_at: null }).eq("id", target.id);
        throw e;
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from("offers")
      .update({ status: "accepted", checkout_url: stripeSession?.url ?? null, accepting_at: null })
      .eq("id", target.id)
      .eq("status", "sent")
      .select("*")
      .single();

    if (upErr || !updated)
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409, headers: JSONH });

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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
