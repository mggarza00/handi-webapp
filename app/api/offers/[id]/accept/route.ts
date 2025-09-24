import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { createBearerClient } from "@/lib/supabase";

import { assertRateLimit } from "@/lib/rate/limit";
import type { Database } from "@/types/supabase";

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

    // Resolve acting user (prefer bearer token, fallback cookie, finally x-user-id for dev)
    const supabase = createRouteHandlerClient<Database>({ cookies });
    let actingUserId: string | null = null;
    const authHeader = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim();
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch?.[1] || (req.headers.get("x-access-token") || "").trim();
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
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, headers: JSONH });

    // Rate limit best-effort: skip if unauthenticated via cookie (dev headers/bearer may be used)
    try {
      const rate = await assertRateLimit("offer.accept", 30, 3);
      if (!rate.ok)
        return NextResponse.json({ error: "RATE_LIMIT", message: rate.message }, { status: rate.status, headers: JSONH });
    } catch (e) {
      // ignore UNAUTHENTICATED from assertRateLimit when using x-user-id/bearer in dev
    }

    const offerId = params.id;
    // Optional fallback context for resolving the right offer
    let conversationIdBody: string | null = null;
    let probeTitle: string | null = null;
    let probeAmount: number | null = null;
    let probeCurrency: string | null = null;
    try {
      const raw = await req.text();
      if (raw && raw.trim().length) {
        const b = JSON.parse(raw) as { conversationId?: string; title?: string | null; amount?: number | null; currency?: string | null };
        if (b?.conversationId && typeof b.conversationId === "string") {
          conversationIdBody = b.conversationId;
        }
        if (typeof b?.title === "string") probeTitle = b.title;
        if (typeof b?.amount === "number" && Number.isFinite(b.amount)) probeAmount = b.amount;
        if (typeof b?.currency === "string" && b.currency.trim().length) probeCurrency = b.currency.toUpperCase();
      }
    } catch {
      // ignore invalid body
    }
    if (!offerId)
      return NextResponse.json({ error: "MISSING_OFFER" }, { status: 400, headers: JSONH });

    let offer: any = null;
    {
      const { data, error } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
      offer = !error ? data || null : null;
    }
    if (!offer && conversationIdBody) {
      // Fallback: resolve latest 'sent' offer by conversation id
      const { data: convOffer } = await supabase
        .from("offers")
        .select("*")
        .eq("conversation_id", conversationIdBody)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      offer = convOffer || null;
    }
    if (!offer && conversationIdBody && (probeTitle || probeAmount || probeCurrency)) {
      // Fallback: try matching by fields
      let q = supabase
        .from("offers")
        .select("*")
        .eq("conversation_id", conversationIdBody)
        .order("created_at", { ascending: false })
        .limit(5);
      const { data: rows } = await q;
      if (rows && rows.length) {
        const norm = (s: string | null) => (s || "").trim().toUpperCase();
        const targetTitle = norm(probeTitle);
        const targetCurr = norm(probeCurrency);
        offer = rows.find((r: any) => {
          const t = norm(r.title as string | null);
          const c = norm((r.currency as string | null) || "MXN");
          const a = Number(r.amount);
          const sent = String(r.status) === "sent";
          const titleOk = targetTitle ? t === targetTitle : true;
          const currOk = targetCurr ? c === targetCurr : true;
          const amtOk = typeof probeAmount === "number" && Number.isFinite(probeAmount) ? Math.abs(a - probeAmount) < 0.005 : true;
          return sent && titleOk && currOk && amtOk;
        }) || null;
      }
    }
    if (!offer && conversationIdBody) {
      // Fallback #2: latest offer by conversation (any status)
      const { data: anyOffer } = await supabase
        .from("offers")
        .select("*")
        .eq("conversation_id", conversationIdBody)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      offer = anyOffer || null;
    }
    if (!offer)
      return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404, headers: JSONH });

    if (offer.professional_id !== actingUserId)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: JSONH });
    if (offer.status !== "sent")
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409, headers: JSONH });

    const lockTime = new Date().toISOString();
    const { data: locked, error: lockErr } = await supabase
      .from("offers")
      .update({ accepting_at: lockTime })
      .eq("id", offer.id)
      .is("accepting_at", null)
      .eq("status", "sent")
      .select("*")
      .single();

    if (lockErr || !locked) {
      // Intento de recuperación: si el lock está "atascado" desde hace más de 2 minutos, retomarlo
      const { data: row } = await supabase
        .from("offers")
        .select("id, status, accepting_at, currency, amount, title, description, conversation_id, professional_id")
        .eq("id", offer.id)
        .single();
      if (!row) {
        return NextResponse.json(
          { error: "OFFER_NOT_FOUND" },
          { status: 404, headers: JSONH },
        );
      }
      if (row.status !== "sent") {
        return NextResponse.json(
          { error: "INVALID_STATUS" },
          { status: 409, headers: JSONH },
        );
      }
      const accAt = (row as { accepting_at?: string | null }).accepting_at || null;
      const stuck = accAt ? Date.now() - new Date(accAt).getTime() > 2 * 60 * 1000 : false;
      if (stuck) {
        const { data: relocked } = await supabase
          .from("offers")
          .update({ accepting_at: lockTime })
          .eq("id", offer.id)
          .eq("status", "sent")
          .select("*")
          .single();
        if (!relocked) {
          return NextResponse.json(
            { error: "LOCKED", message: "Ya se esta procesando la oferta" },
            { status: 409, headers: JSONH },
          );
        }
      } else {
        return NextResponse.json(
          { error: "LOCKED", message: "Ya se esta procesando la oferta" },
          { status: 409, headers: JSONH },
        );
      }
    }

    if (stripe) {
      try {
        stripeSession = await stripe.checkout.sessions.create({
          mode: "payment",
          success_url: `${APP_URL}/offers/${offer.id}?status=success`,
          cancel_url: `${APP_URL}/offers/${offer.id}?status=cancel`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: (locked.currency || "MXN").toLowerCase(),
                unit_amount: Math.round(Number(locked.amount) * 100),
                product_data: {
                  name: locked.title,
                  description: locked.description || undefined,
                },
              },
            },
          ],
          metadata: {
            offer_id: locked.id,
            conversation_id: locked.conversation_id,
          },
        });
      } catch (stripeError) {
        await supabase.from("offers").update({ accepting_at: null }).eq("id", offer.id);
        throw stripeError;
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from("offers")
      .update({ status: "accepted", checkout_url: stripeSession?.url ?? null, accepting_at: null })
      .eq("id", offer.id)
      .eq("status", "sent")
      .select("*")
      .single();

    if (updateErr || !updated) {
      await supabase.from("offers").update({ accepting_at: null }).eq("id", offer.id);
      return NextResponse.json(
        { error: "INVALID_STATUS", checkoutUrl: stripeSession ? stripeSession.url : null },
        { status: 409, headers: JSONH },
      );
    }

    if (stripeSession && stripeSession.url) {
      await fetch(`${APP_URL}/api/notify/offer-accepted`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ offerId: offer.id }),
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

