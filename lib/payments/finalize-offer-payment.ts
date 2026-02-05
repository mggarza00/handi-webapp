import { revalidatePath, revalidateTag } from "next/cache";

import { notifyChatMessageByConversation } from "@/lib/chat-notifier";
import { getAdminSupabase } from "@/lib/supabase/admin";

type FinalizeArgs = {
  offerId: string;
  paymentIntentId?: string | null;
  source: "webhook" | "sync";
};

type FinalizeResult = {
  ok: boolean;
  requestId?: string | null;
  conversationId?: string | null;
  proId?: string | null;
};

function parseServiceDate(raw?: string | null) {
  if (!raw) return { date: null as string | null, time: null as string | null };
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime()))
    return { date: null as string | null, time: null as string | null };
  return {
    date: dt.toISOString().slice(0, 10),
    time: dt.toISOString().slice(11, 16),
  };
}

export async function finalizeOfferPayment(
  args: FinalizeArgs,
): Promise<FinalizeResult> {
  try {
    const admin = getAdminSupabase();
    const offerId = args.offerId.trim();
    if (!offerId) return { ok: false };
    const { data: offer } = await admin
      .from("offers")
      .select(
        "id,status,conversation_id,client_id,professional_id,amount,currency,service_date,payment_intent_id",
      )
      .eq("id", offerId)
      .maybeSingle();
    if (!offer) return { ok: false };

    const nowIso = new Date().toISOString();
    const parsedService = parseServiceDate(
      (offer as { service_date?: string | null }).service_date ?? null,
    );

    const conversationId =
      (offer as { conversation_id?: string | null }).conversation_id ?? null;
    let clientId =
      (offer as { client_id?: string | null }).client_id ?? null;
    let proId =
      (offer as { professional_id?: string | null }).professional_id ?? null;
    let requestId: string | null = null;
    let requestTitle: string | null = null;
    let requestRequiredAt: string | null = null;
    let requestScheduledDate: string | null = null;
    let requestScheduledTime: string | null = null;

    if (conversationId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("request_id, customer_id, pro_id")
        .eq("id", conversationId)
        .maybeSingle();
      requestId = (conv as { request_id?: string | null } | null)?.request_id
        ? (conv as { request_id?: string | null }).request_id ?? null
        : null;
      if (!clientId)
        clientId =
          (conv as { customer_id?: string | null } | null)?.customer_id ?? null;
      if (!proId)
        proId = (conv as { pro_id?: string | null } | null)?.pro_id ?? null;
    }

    if (requestId) {
      const { data: req } = await admin
        .from("requests")
        .select("title, created_by, required_at, scheduled_date, scheduled_time")
        .eq("id", requestId)
        .maybeSingle();
      requestTitle =
        ((req as { title?: string | null } | null)?.title as string | null) ??
        "Servicio";
      if (!clientId) {
        clientId =
          (req as { created_by?: string | null } | null)?.created_by ?? null;
      }
      requestRequiredAt =
        (req as { required_at?: string | null } | null)?.required_at ?? null;
      requestScheduledDate =
        (req as { scheduled_date?: string | null } | null)?.scheduled_date ??
        null;
      requestScheduledTime =
        (req as { scheduled_time?: string | null } | null)?.scheduled_time ??
        null;
    }

    const scheduledDate =
      parsedService.date ||
      requestScheduledDate ||
      (requestRequiredAt ? requestRequiredAt.slice(0, 10) : null) ||
      nowIso.slice(0, 10);
    const scheduledTime =
      parsedService.time || requestScheduledTime || "09:00";

    await admin
      .from("offers")
      .update({
        status: "paid",
        payment_intent_id:
          args.paymentIntentId ||
          (offer as { payment_intent_id?: string | null }).payment_intent_id ||
          null,
        checkout_url: null,
        accepting_at: null,
        updated_at: nowIso,
      })
      .eq("id", offer.id);

    let agreementId: string | null = null;
    if (requestId && proId) {
      try {
        const { data: existing } = await admin
          .from("agreements")
          .select("id,status,scheduled_date,scheduled_time")
          .eq("request_id", requestId)
          .eq("professional_id", proId)
          .maybeSingle();
        if (existing?.id) {
          const patch: Record<string, unknown> = { updated_at: nowIso };
          const st = String((existing as any).status || "").toLowerCase();
          if (!(st === "in_progress" || st === "completed")) {
            patch.status = "paid" as any;
          }
          if (typeof (offer as any).amount === "number")
            patch.amount = (offer as any).amount;
          if (scheduledDate && !(existing as any)?.scheduled_date) {
            patch.scheduled_date = scheduledDate;
          }
          if (scheduledTime && !(existing as any)?.scheduled_time) {
            patch.scheduled_time = scheduledTime;
          }
          if (Object.keys(patch).length > 1) {
            await admin.from("agreements").update(patch).eq("id", existing.id);
          }
          agreementId = existing.id as string;
        }
      } catch {
        /* ignore select/update */
      }
      if (!agreementId) {
        try {
          const { data: ins } = await (admin as any)
            .from("agreements")
            .upsert(
              {
                request_id: requestId,
                professional_id: proId,
                amount:
                  typeof (offer as any).amount === "number"
                    ? (offer as any).amount
                    : null,
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
          if (ins?.id) agreementId = ins.id as string;
        } catch {
          /* ignore upsert */
        }
      }
      // Cancel other pending agreements for this request
      try {
        await admin
          .from("agreements")
          .update({ status: "cancelled" as any, updated_at: nowIso })
          .eq("request_id", requestId)
          .neq("professional_id", proId)
          .not("status", "in", "(paid,in_progress,completed,cancelled,disputed)");
      } catch {
        /* ignore */
      }
    }

    if (requestId) {
      const patch: Record<string, unknown> = {
        status: "scheduled" as any,
        is_explorable: false as any,
        visible_in_explore: false as any,
        updated_at: nowIso,
      };
      if (proId) {
        (patch as any).professional_id = proId;
        (patch as any).accepted_professional_id = proId;
      }
      if (scheduledDate) (patch as any).scheduled_date = scheduledDate;
      if (scheduledTime) (patch as any).scheduled_time = scheduledTime;
      if (agreementId) (patch as any).agreement_id = agreementId;
      if (!requestRequiredAt && scheduledDate)
        (patch as any).required_at = scheduledDate;
      try {
        await admin.from("requests").update(patch).eq("id", requestId);
      } catch {
        /* ignore */
      }
    }

    if (requestId && proId) {
      try {
        await (admin as any).from("pro_calendar_events").upsert(
          {
            pro_id: proId,
            request_id: requestId,
            title: requestTitle || "Servicio",
            scheduled_date: scheduledDate || null,
            scheduled_time: scheduledTime || null,
            status: "scheduled",
          },
          { onConflict: "request_id" },
        );
      } catch {
        /* ignore calendar errors */
      }
    }

    if (conversationId && clientId) {
      try {
        const { data: existing } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
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
          const body = whenStr
            ? `Pago confirmado. Servicio agendado para ${whenStr}`
            : "Pago realizado. Servicio agendado.";
          await admin.from("messages").insert({
            conversation_id: conversationId,
            sender_id: clientId,
            body,
            message_type: "system",
            payload,
          } as any);
          await notifyChatMessageByConversation({
            conversationId,
            senderId: clientId,
            text: body,
          });
        }
      } catch {
        /* ignore */
      }
    }

    try {
      if (requestId) revalidatePath(`/requests/${requestId}`);
      if (conversationId) revalidatePath(`/mensajes/${conversationId}`);
      revalidatePath("/pro/calendar");
      revalidateTag("pro-calendar");
    } catch {
      /* ignore */
    }

    return { ok: true, requestId, conversationId, proId };
  } catch {
    return { ok: false };
  }
}
