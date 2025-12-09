import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type OfferRow = {
  id: string;
  status: string;
  conversation_id: string | null;
  client_id: string | null;
  professional_id: string | null;
  payment_intent_id: string | null;
  checkout_url: string | null;
  service_date: string | null;
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
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "SERVER_MISCONFIGURED:STRIPE" },
        { status: 500, headers: JSONH },
      );
    }
    const offerId = (params?.id || "").trim();
    if (!offerId)
      return NextResponse.json(
        { error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );

    const body = (await req.json().catch(() => ({}))) as {
      paymentIntentId?: string | null;
    };
    const requestedPiId =
      typeof body.paymentIntentId === "string"
        ? body.paymentIntentId.trim()
        : null;

    const { data: offer, error } = await supabase
      .from("offers")
      .select(
        "id,status,conversation_id,client_id,professional_id,payment_intent_id,checkout_url,service_date",
      )
      .eq("id", offerId)
      .single<OfferRow>();
    if (error || !offer)
      return NextResponse.json(
        { error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );

    // Require the caller to be the client or professional of the offer (soft guard)
    try {
      const dbUser = supabase.auth.getUser
        ? await supabase.auth.getUser()
        : null;
      const uid = (dbUser as any)?.data?.user?.id as string | undefined;
      if (
        uid &&
        offer.client_id &&
        uid !== offer.client_id &&
        offer.professional_id &&
        uid !== offer.professional_id
      ) {
        return NextResponse.json(
          { error: "FORBIDDEN" },
          { status: 403, headers: JSONH },
        );
      }
    } catch {
      /* ignore soft auth failures (service role may not support getUser) */
    }

    const piId = requestedPiId || offer.payment_intent_id;
    if (!piId)
      return NextResponse.json(
        { error: "MISSING_PAYMENT_INTENT" },
        { status: 400, headers: JSONH },
      );

    const paymentIntent = await stripe.paymentIntents.retrieve(piId, {
      expand: ["latest_charge"],
    });
    if (
      !paymentIntent ||
      (paymentIntent.status !== "succeeded" &&
        paymentIntent.status !== "requires_capture")
    ) {
      return NextResponse.json(
        { error: "PAYMENT_NOT_CONFIRMED", status: paymentIntent?.status },
        { status: 409, headers: JSONH },
      );
    }

    const receiptUrl =
      typeof (paymentIntent.latest_charge as any)?.receipt_url === "string"
        ? ((paymentIntent.latest_charge as any).receipt_url as string)
        : null;

    // Update offer status to paid (idempotent)
    await supabase
      .from("offers")
      .update({
        status: "paid",
        payment_intent_id: paymentIntent.id,
        checkout_url: null,
        accepting_at: null,
      })
      .eq("id", offer.id);

    // Mark request as in_process best-effort
    let requestId: string | null = null;
    if (offer.conversation_id) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("request_id")
        .eq("id", offer.conversation_id)
        .maybeSingle<{ request_id: string | null }>();
      requestId = conv?.request_id ?? null;
      if (requestId) {
        try {
          await supabase
            .from("requests")
            .update({
              status: "in_process" as any,
              is_explorable: false as any,
              visible_in_explore: false as any,
            })
            .eq("id", requestId);
        } catch {
          /* ignore */
        }
      }
    }

    // Insert paid message if not exists
    if (offer.conversation_id && offer.client_id) {
      try {
        const { data: existing } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", offer.conversation_id)
          .eq("message_type", "system")
          .contains("payload", { offer_id: offer.id, status: "paid" })
          .limit(1);
        const has = Array.isArray(existing) && existing.length > 0;
        if (!has) {
          const payload: Record<string, unknown> = {
            offer_id: offer.id,
            status: "paid",
          };
          if (receiptUrl) payload.receipt_url = receiptUrl;
          await supabase.from("messages").insert({
            conversation_id: offer.conversation_id,
            sender_id: offer.client_id,
            body: "Pago realizado. Servicio agendado.",
            message_type: "system",
            payload,
          } as any);
        }
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json(
      {
        ok: true,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
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
