import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { finalizeOfferPayment } from "@/lib/payments/finalize-offer-payment";

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
  amount: number | null;
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
        "id,status,conversation_id,client_id,professional_id,payment_intent_id,checkout_url,service_date,amount",
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

    const finalize = await finalizeOfferPayment({
      offerId,
      paymentIntentId: paymentIntent.id,
      source: "sync",
    });
    if (!finalize.ok) {
      return NextResponse.json(
        { error: "FINALIZE_FAILED" },
        { status: 500, headers: JSONH },
      );
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
