import { revalidatePath, revalidateTag } from "next/cache";
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

    const receiptUrl =
      typeof (paymentIntent.latest_charge as any)?.receipt_url === "string"
        ? ((paymentIntent.latest_charge as any).receipt_url as string)
        : null;
    const nowIso = new Date().toISOString();
    const derivedServiceDate = (() => {
      if (!offer.service_date) return { date: null, time: null };
      const dt = new Date(offer.service_date);
      if (Number.isNaN(dt.getTime())) return { date: null, time: null };
      return {
        date: dt.toISOString().slice(0, 10),
        time: dt.toISOString().slice(11, 16),
      };
    })();

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

    // Mark request + agreements as paid/scheduled best-effort
    let requestId: string | null = null;
    let requestTitle: string | null = null;
    let requestClientId: string | null = null;
    let scheduledDate: string | null = null;
    let scheduledTime: string | null = null;
    let agreementId: string | null = null;
    if (offer.conversation_id) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("request_id")
        .eq("id", offer.conversation_id)
        .maybeSingle<{ request_id: string | null }>();
      requestId = conv?.request_id ?? null;
      if (requestId) {
        try {
          const { data: req } = await supabase
            .from("requests")
            .select(
              "id,title,created_by,scheduled_date,scheduled_time,required_at",
            )
            .eq("id", requestId)
            .maybeSingle();
          requestTitle =
            ((req as any)?.title as string | undefined) || "Servicio";
          requestClientId =
            ((req as any)?.created_by as string | undefined) || null;
          const reqScheduledDate =
            ((req as any)?.scheduled_date as string | null) || null;
          const reqScheduledTime =
            ((req as any)?.scheduled_time as string | null) || null;
          const reqRequiredAt =
            ((req as any)?.required_at as string | null) || null;
          scheduledDate =
            reqScheduledDate ||
            derivedServiceDate.date ||
            (reqRequiredAt ? reqRequiredAt.slice(0, 10) : null) ||
            nowIso.slice(0, 10);
          scheduledTime = reqScheduledTime || derivedServiceDate.time || null;
        } catch {
          scheduledDate = derivedServiceDate.date || nowIso.slice(0, 10);
          scheduledTime = derivedServiceDate.time || null;
        }

        const ensureAgreement = async (): Promise<string | null> => {
          if (!requestId || !offer.professional_id) return null;
          try {
            const { data: existing } = await supabase
              .from("agreements")
              .select("id,status,scheduled_date,scheduled_time")
              .eq("request_id", requestId)
              .eq("professional_id", offer.professional_id)
              .maybeSingle();
            if (existing?.id) {
              const patch: Record<string, unknown> = { updated_at: nowIso };
              const st = String((existing as any).status || "").toLowerCase();
              if (!(st === "in_progress" || st === "completed")) {
                patch.status = "paid" as any;
              }
              if (typeof offer.amount === "number") patch.amount = offer.amount;
              if (scheduledDate && !(existing as any)?.scheduled_date) {
                patch.scheduled_date = scheduledDate;
              }
              if (scheduledTime && !(existing as any)?.scheduled_time) {
                patch.scheduled_time = scheduledTime;
              }
              if (Object.keys(patch).length > 1) {
                await supabase
                  .from("agreements")
                  .update(patch)
                  .eq("id", existing.id);
              }
              return existing.id as string;
            }
          } catch {
            /* ignore select/update */
          }
          try {
            const { data: ins } = await (supabase as any)
              .from("agreements")
              .upsert(
                {
                  request_id: requestId,
                  professional_id: offer.professional_id,
                  amount:
                    typeof offer.amount === "number" ? offer.amount : null,
                  status: "paid" as any,
                  scheduled_date: scheduledDate || null,
                  scheduled_time: scheduledTime || null,
                  created_at: nowIso,
                  updated_at: nowIso,
                },
                { onConflict: "request_id,professional_id" },
              )
              .select("id")
              .maybeSingle();
            if (ins?.id) return ins.id as string;
          } catch {
            /* ignore upsert */
          }
          return null;
        };
        agreementId = await ensureAgreement();

        const patch: Record<string, unknown> = {
          status: scheduledDate ? ("scheduled" as any) : ("in_process" as any),
          is_explorable: false as any,
          visible_in_explore: false as any,
          updated_at: nowIso,
        };
        if (offer.professional_id) {
          (patch as any).professional_id = offer.professional_id;
          (patch as any).accepted_professional_id = offer.professional_id;
        }
        if (scheduledDate) (patch as any).scheduled_date = scheduledDate;
        if (scheduledTime) (patch as any).scheduled_time = scheduledTime;
        if (agreementId) (patch as any).agreement_id = agreementId;
        try {
          await supabase.from("requests").update(patch).eq("id", requestId);
        } catch {
          /* ignore */
        }

        // Upsert calendar event (best effort)
        try {
          if (offer.professional_id) {
            await (supabase as any).from("pro_calendar_events").upsert(
              {
                pro_id: offer.professional_id,
                request_id: requestId,
                title: requestTitle || "Servicio",
                scheduled_date: scheduledDate || null,
                scheduled_time: scheduledTime || null,
                status: "scheduled",
              },
              { onConflict: "request_id" },
            );
          }
        } catch {
          /* ignore calendar errors */
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
          const whenStr = scheduledDate
            ? `${scheduledDate}${scheduledTime ? ` ${scheduledTime}` : ""}`
            : null;
          const payload: Record<string, unknown> = {
            offer_id: offer.id,
            status: "paid",
          };
          if (receiptUrl) payload.receipt_url = receiptUrl;
          const body = whenStr
            ? `Pago confirmado. Servicio agendado para ${whenStr}`
            : "Pago realizado. Servicio agendado.";
          await supabase.from("messages").insert({
            conversation_id: offer.conversation_id,
            sender_id: offer.client_id,
            body,
            message_type: "system",
            payload,
          } as any);
          try {
            const { notifyChatMessageByConversation } = await import(
              "@/lib/chat-notifier"
            );
            await notifyChatMessageByConversation({
              conversationId: offer.conversation_id,
              senderId: offer.client_id,
              text: body,
            });
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Best-effort cache revalidation
    try {
      if (requestId) revalidatePath(`/requests/${requestId}`);
      if (offer.conversation_id)
        revalidatePath(`/mensajes/${offer.conversation_id}`);
      revalidatePath("/pro/calendar");
      revalidateTag("pro-calendar");
    } catch {
      /* ignore */
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
