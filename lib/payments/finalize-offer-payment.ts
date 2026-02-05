import { createHash } from "crypto";

import { revalidatePath, revalidateTag } from "next/cache";

import { notifyChatMessageByConversation } from "@/lib/chat-notifier";
import { sendEmail } from "@/lib/email";
import { getStripeForMode, type StripeMode } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

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

type AgreementUpdate = Database["public"]["Tables"]["agreements"]["Update"];
type AgreementInsert = Database["public"]["Tables"]["agreements"]["Insert"];
type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];
type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
type ConversationRow = {
  request_id?: string | null;
  customer_id?: string | null;
  pro_id?: string | null;
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

function isMissingPaymentIntent(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code || "";
  if (code === "resource_missing") return true;
  const message = err instanceof Error ? err.message : "";
  return message.includes("No such payment_intent");
}

function buildStableMessageId(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
        "id,status,conversation_id,client_id,professional_id,amount,currency,service_date,payment_intent_id,payment_mode",
      )
      .eq("id", offerId)
      .maybeSingle();
    if (!offer) return { ok: false };

    const nowIso = new Date().toISOString();
    const parsedService = parseServiceDate(offer.service_date ?? null);

    const conversationId = offer.conversation_id ?? null;
    let clientId = offer.client_id ?? null;
    let proId = offer.professional_id ?? null;
    let requestId: string | null = null;
    let requestTitle: string | null = null;
    let requestRequiredAt: string | null = null;
    let requestScheduledDate: string | null = null;
    let requestScheduledTime: string | null = null;
    let requestAddressLine: string | null = null;
    let requestCity: string | null = null;
    let proEmail: string | null = null;
    let proName: string | null = null;

    if (conversationId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("request_id, customer_id, pro_id")
        .eq("id", conversationId)
        .maybeSingle();
      const convRow = conv as ConversationRow | null;
      requestId = convRow?.request_id ?? null;
      if (!clientId) clientId = convRow?.customer_id ?? null;
      if (!proId) proId = convRow?.pro_id ?? null;
    }

    if (requestId) {
      const { data: req } = await admin
        .from("requests")
        .select(
          "title, created_by, required_at, scheduled_date, scheduled_time, address_line, city",
        )
        .eq("id", requestId)
        .maybeSingle();
      const reqRow = (req ?? null) as {
        title?: string | null;
        created_by?: string | null;
        required_at?: string | null;
        scheduled_date?: string | null;
        scheduled_time?: string | null;
        address_line?: string | null;
        city?: string | null;
      } | null;
      requestTitle = reqRow?.title ?? "Servicio";
      if (!clientId) {
        clientId = reqRow?.created_by ?? null;
      }
      requestRequiredAt = reqRow?.required_at ?? null;
      requestScheduledDate = reqRow?.scheduled_date ?? null;
      requestScheduledTime = reqRow?.scheduled_time ?? null;
      requestAddressLine = reqRow?.address_line ?? null;
      requestCity = reqRow?.city ?? null;
    }
    if (proId) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", proId)
          .maybeSingle();
        const profileRow = profile as {
          email?: string | null;
          full_name?: string | null;
        } | null;
        proEmail = profileRow?.email ?? null;
        proName = profileRow?.full_name ?? null;
      } catch {
        /* ignore */
      }
    }

    const scheduledDate =
      parsedService.date ||
      requestScheduledDate ||
      (requestRequiredAt ? requestRequiredAt.slice(0, 10) : null) ||
      nowIso.slice(0, 10);
    const scheduledTime = parsedService.time || requestScheduledTime || "09:00";
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    let receiptId: string | null = null;
    let receiptUrl: string | null = null;
    let receiptDownloadUrl: string | null = null;
    try {
      if (offer.id) {
        const { data: recByOfferRaw } = await admin
          .from("receipts")
          .select("id")
          .eq("offer_id", offer.id)
          .order("created_at", { ascending: false })
          .limit(1);
        const recByOffer = Array.isArray(recByOfferRaw)
          ? (recByOfferRaw as Array<{ id?: string | null }>)
          : [];
        if (recByOffer.length) {
          receiptId = recByOffer[0]?.id ?? null;
        }
      }
      if (!receiptId && offer.payment_intent_id) {
        const { data: recByPiRaw } = await admin
          .from("receipts")
          .select("id")
          .eq("payment_intent_id", offer.payment_intent_id)
          .order("created_at", { ascending: false })
          .limit(1);
        const recByPi = Array.isArray(recByPiRaw)
          ? (recByPiRaw as Array<{ id?: string | null }>)
          : [];
        if (recByPi.length) {
          receiptId = recByPi[0]?.id ?? null;
        }
      }
    } catch {
      /* ignore receipt lookup */
    }
    const paymentIntentId =
      args.paymentIntentId || offer.payment_intent_id || null;
    if (paymentIntentId) {
      let mode: StripeMode = offer.payment_mode === "test" ? "test" : "live";
      let stripe = await getStripeForMode(mode);
      if (!stripe) {
        stripe = await getStripeForMode("live");
        mode = "live";
      }
      if (stripe) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["latest_charge"],
          });
          const charge =
            (pi as { latest_charge?: unknown } | null)?.latest_charge ?? null;
          if (typeof charge === "string") {
            const full = await stripe.charges.retrieve(charge);
            receiptUrl =
              typeof (full as { receipt_url?: string } | null)?.receipt_url ===
              "string"
                ? ((full as { receipt_url?: string }).receipt_url as string)
                : null;
          } else if (
            charge &&
            typeof (charge as { receipt_url?: unknown }).receipt_url ===
              "string"
          ) {
            receiptUrl =
              (charge as { receipt_url?: string }).receipt_url || null;
          }
        } catch (err) {
          if (isMissingPaymentIntent(err)) {
            const fallbackMode: StripeMode = mode === "live" ? "test" : "live";
            const fallbackStripe = await getStripeForMode(fallbackMode);
            if (fallbackStripe) {
              try {
                const pi = await fallbackStripe.paymentIntents.retrieve(
                  paymentIntentId,
                  { expand: ["latest_charge"] },
                );
                const charge =
                  (pi as { latest_charge?: unknown } | null)?.latest_charge ??
                  null;
                if (typeof charge === "string") {
                  const full = await fallbackStripe.charges.retrieve(charge);
                  receiptUrl =
                    typeof (full as { receipt_url?: string } | null)
                      ?.receipt_url === "string"
                      ? ((full as { receipt_url?: string })
                          .receipt_url as string)
                      : null;
                } else if (
                  charge &&
                  typeof (charge as { receipt_url?: unknown }).receipt_url ===
                    "string"
                ) {
                  receiptUrl =
                    (charge as { receipt_url?: string }).receipt_url || null;
                }
              } catch {
                /* ignore fallback stripe */
              }
            }
          }
        }
      }
    }
    if (receiptId) {
      receiptDownloadUrl = `${baseUrl}/api/receipts/${encodeURIComponent(
        receiptId,
      )}/pdf`;
    }

    await admin
      .from("offers")
      .update({
        status: "paid",
        payment_intent_id:
          args.paymentIntentId || offer.payment_intent_id || null,
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
          const patch: AgreementUpdate = { updated_at: nowIso };
          const st = String(existing.status ?? "").toLowerCase();
          if (!(st === "in_progress" || st === "completed")) {
            patch.status = "paid";
          }
          if (typeof offer.amount === "number") patch.amount = offer.amount;
          if (scheduledDate && !existing.scheduled_date) {
            patch.scheduled_date = scheduledDate;
          }
          if (scheduledTime && !existing.scheduled_time) {
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
          const insertRow: AgreementInsert = {
            request_id: requestId,
            professional_id: proId,
            amount: typeof offer.amount === "number" ? offer.amount : null,
            status: "paid",
            scheduled_date: scheduledDate || null,
            scheduled_time: scheduledTime || null,
            created_at: nowIso,
            updated_at: nowIso,
          };
          const { data: ins } = await admin
            .from("agreements")
            .upsert(insertRow, { onConflict: "request_id,professional_id" })
            .select("id")
            .maybeSingle();
          if (ins?.id) agreementId = ins.id as string;
        } catch {
          /* ignore upsert */
        }
      }
      // Cancel other pending agreements for this request
      try {
        const cancelPatch: AgreementUpdate = {
          status: "cancelled",
          updated_at: nowIso,
        };
        await admin
          .from("agreements")
          .update(cancelPatch)
          .eq("request_id", requestId)
          .neq("professional_id", proId)
          .in("status", ["negotiating", "accepted", "paid"]);
      } catch {
        /* ignore */
      }
    }

    if (requestId) {
      const patch: RequestUpdate = {
        status: "scheduled",
        is_explorable: false,
        visible_in_explore: false,
        updated_at: nowIso,
      };
      if (proId) {
        patch.professional_id = proId;
        patch.accepted_professional_id = proId;
      }
      if (scheduledDate) patch.scheduled_date = scheduledDate;
      if (scheduledTime) patch.scheduled_time = scheduledTime;
      if (agreementId) patch.agreement_id = agreementId;
      if (!requestRequiredAt && scheduledDate)
        patch.required_at = scheduledDate;
      try {
        await admin.from("requests").update(patch).eq("id", requestId);
      } catch {
        /* ignore */
      }
    }

    if (requestId && proId) {
      try {
        const adminUntyped = admin as unknown as {
          from: (table: string) => {
            upsert: (values: unknown, options?: unknown) => Promise<unknown>;
          };
        };
        await adminUntyped.from("pro_calendar_events").upsert(
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
      const hasSystemMessage = async (
        match: Record<string, unknown>,
        messageId?: string,
      ) => {
        if (messageId) {
          const { data: existingById } = await admin
            .from("messages")
            .select("id")
            .eq("id", messageId)
            .maybeSingle();
          if (existingById?.id) return true;
        }
        const { data: existing } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("message_type", "system")
          .contains("payload", match)
          .limit(1);
        return Array.isArray(existing) && existing.length > 0;
      };
      try {
        const paidPayload: Record<string, unknown> = {
          offer_id: offer.id,
          status: "paid",
        };
        const paidMessageId = buildStableMessageId(
          `paid:${conversationId}:${offer.id}`,
        );
        if (!(await hasSystemMessage(paidPayload, paidMessageId))) {
          const body = "Pago realizado. Servicio agendado.";
          const messageInsert: MessageInsert = {
            id: paidMessageId,
            conversation_id: conversationId,
            sender_id: clientId,
            body,
            message_type: "system",
            payload: paidPayload as MessageInsert["payload"],
          };
          await admin
            .from("messages")
            .upsert(messageInsert, { onConflict: "id" });
          await notifyChatMessageByConversation({
            conversationId,
            senderId: clientId,
            text: body,
          });
        }
        const addressLine = requestAddressLine?.toString().trim() || "";
        const city = requestCity?.toString().trim() || "";
        if (addressLine || city) {
          const addressPayload: Record<string, unknown> = {
            offer_id: offer.id,
            status: "paid",
            type: "service_scheduled_address",
            address_line: addressLine || null,
            city: city || null,
          };
          const addressMessageId = buildStableMessageId(
            `paid_address:${conversationId}:${offer.id}`,
          );
          const hasAddress = await hasSystemMessage(
            {
              offer_id: offer.id,
              status: "paid",
              type: "service_scheduled_address",
            },
            addressMessageId,
          );
          if (!hasAddress) {
            const line = [addressLine, city].filter(Boolean).join(", ");
            const body = line
              ? `Servicio agendado en ${line}.`
              : "Servicio agendado.";
            const messageInsert: MessageInsert = {
              id: addressMessageId,
              conversation_id: conversationId,
              sender_id: clientId,
              body,
              message_type: "system",
              payload: addressPayload as MessageInsert["payload"],
            };
            await admin
              .from("messages")
              .upsert(messageInsert, { onConflict: "id" });
          }
        }
        if (receiptId || receiptUrl) {
          let hasReceipt = false;
          const receiptMessageId = buildStableMessageId(
            `paid_receipt:${conversationId}:${offer.id}`,
          );
          if (receiptId) {
            hasReceipt = await hasSystemMessage(
              { receipt_id: receiptId },
              receiptMessageId,
            );
          }
          if (!hasReceipt) {
            hasReceipt = await hasSystemMessage(
              {
                offer_id: offer.id,
                status: "paid",
                type: "payment_receipt",
              },
              receiptMessageId,
            );
          }
          if (!hasReceipt) {
            const receiptPayload: Record<string, unknown> = {
              offer_id: offer.id,
              status: "paid",
              type: "payment_receipt",
            };
            if (receiptId) receiptPayload.receipt_id = receiptId;
            if (receiptDownloadUrl)
              receiptPayload.download_url = receiptDownloadUrl;
            if (receiptUrl) receiptPayload.receipt_url = receiptUrl;
            const messageInsert: MessageInsert = {
              id: receiptMessageId,
              conversation_id: conversationId,
              sender_id: clientId,
              body: "Comprobante de pago",
              message_type: "system",
              payload: receiptPayload as MessageInsert["payload"],
            };
            await admin
              .from("messages")
              .upsert(messageInsert, { onConflict: "id" });
          }
        }
      } catch {
        /* ignore */
      }
    }

    let notifiedPro = false;
    if (proId) {
      try {
        const link = conversationId
          ? `${baseUrl}/mensajes/${encodeURIComponent(conversationId)}`
          : `${baseUrl}/pro`;
        const addressLine = requestAddressLine?.toString().trim() || "";
        const city = requestCity?.toString().trim() || "";
        const line = [addressLine, city].filter(Boolean).join(", ");
        const body = line
          ? `La oferta fue pagada. Servicio agendado en ${line}.`
          : "La oferta fue pagada. Servicio agendado.";
        const { data: existing } = await admin
          .from("user_notifications")
          .select("id")
          .eq("user_id", proId)
          .eq("type", "contract_offer_paid")
          .eq("link", link)
          .limit(1);
        const has = Array.isArray(existing) && existing.length > 0;
        if (!has) {
          const adminUntyped = admin as unknown as {
            from: (table: string) => {
              insert: (values: unknown) => Promise<unknown>;
            };
          };
          await adminUntyped.from("user_notifications").insert({
            user_id: proId,
            type: "contract_offer_paid",
            title: "Oferta pagada",
            body,
            link,
          });
          notifiedPro = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (proEmail && notifiedPro) {
      try {
        const title = requestTitle || "Servicio";
        const proUrl = `${baseUrl}/pro`;
        const calendarUrl = `${baseUrl}/pro/calendar`;
        const chatUrl = conversationId
          ? `${baseUrl}/mensajes/${encodeURIComponent(conversationId)}`
          : null;
        const subject = "Handi - Tu oferta fue pagada";
        const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        const safeName = (proName || "Profesional")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;");
        const addressLine = requestAddressLine?.toString().trim() || "";
        const city = requestCity?.toString().trim() || "";
        const addressLineHtml =
          addressLine || city
            ? `<p><strong>Dirección:</strong> ${(addressLine || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")}${
                city
                  ? `, ${city.replace(/&/g, "&amp;").replace(/</g, "&lt;")}`
                  : ""
              }</p>`
            : "";
        const links = [
          `<li><a href="${proUrl}">Ir a tu dashboard</a></li>`,
          `<li><a href="${calendarUrl}">Ver calendario</a></li>`,
          chatUrl ? `<li><a href="${chatUrl}">Abrir chat</a></li>` : null,
        ]
          .filter(Boolean)
          .join("");
        const html = `
          <p>Hola ${safeName},</p>
          <p>Tu oferta de contratacion (<strong>${safeTitle}</strong>) ha sido pagada.</p>
          <p>El servicio se ha agendado y ya aparece en tu cuenta.</p>
          ${addressLineHtml}
          <ul>${links}</ul>
        `;
        await sendEmail({ to: proEmail, subject, html }).catch(() => null);
      } catch {
        /* ignore */
      }
    }

    try {
      if (requestId) revalidatePath(`/requests/${requestId}`);
      if (conversationId) revalidatePath(`/mensajes/${conversationId}`);
      revalidatePath("/pro");
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
