import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getConversationIdForRequest } from "@/app/(app)/mensajes/_lib/getConversationForRequest";
import { getStripe } from "@/lib/stripe";
import type { Database } from "@/types/supabase";

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED:SUPABASE");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type AgreementsUpdate = Database["public"]["Tables"]["agreements"]["Update"];
type RequestsUpdate = Database["public"]["Tables"]["requests"]["Update"];
type MessagesInsert = Database["public"]["Tables"]["messages"]["Insert"];
type MessageAttachmentsInsert = Database["public"]["Tables"]["message_attachments"]["Insert"];
type ProCalendarEventsInsert = Database["public"]["Tables"]["pro_calendar_events"]["Insert"];
type ReceiptPayload = {
  receipt_id: string;
  status: string;
  download_url?: string;
};
type PaidNotificationPayload = {
  offer_id: string;
  status: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("session_id") || "").trim();
  const ridParam = (url.searchParams.get("rid") || url.searchParams.get("request_id") || "").trim();
  const cidParam = (url.searchParams.get("cid") || url.searchParams.get("conversation_id") || "").trim();

  let conversationId: string | null = cidParam || null;
  let requestId: string | null = ridParam || null;
  let offerId: string | null = null;
  let proIdMeta: string | null = null;
  let scheduled_date: string | null = null;
  let scheduled_time: string | null = null;
  let offerServiceDate: string | null = null;

  // 1) Verificar sesión de Stripe (best-effort). Si falla, continuamos sin bloquear.
  const stripe = await getStripe();
  if (stripe && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
      const meta = (session.metadata || {}) as Record<string, string | undefined>;
      conversationId = conversationId || (meta["conversation_id"] || null);
      offerId = (meta["offer_id"] || "").trim() || null;
      proIdMeta = (meta['proId'] || '').trim() || null;
      scheduled_date = (meta['scheduled_date'] || '').trim() || null;
      scheduled_time = (meta['scheduled_time'] || '').trim() || null;
      // Si no recibimos rid, derivarlo por conversation u offer
      if (!requestId) {
        const admin = supaAdmin();
        if (conversationId) {
          const { data } = await admin
            .from("conversations")
            .select("request_id")
            .eq("id", conversationId)
            .maybeSingle<{ request_id: string | null }>();
          requestId = (data?.request_id || null) as string | null;
        }
        if (!requestId && offerId) {
          const { data } = await admin
            .from("offers")
            .select("conversation_id, service_date")
            .eq("id", offerId)
            .maybeSingle<{ conversation_id: string | null; service_date: string | null }>();
          const conv = (data?.conversation_id || null) as string | null;
          if (!offerServiceDate && data?.service_date) offerServiceDate = data.service_date;
          if (conv) {
            const { data: convRow } = await admin
              .from("conversations")
              .select("request_id")
              .eq("id", conv)
              .maybeSingle<{ request_id: string | null }>();
            requestId = (convRow?.request_id || null) as string | null;
            conversationId = conv;
          }
        }
        // Sin fallback de mensaje aquí; el webhook o el endpoint dedicado de pago ya lo manejan.
      }
    } catch {
      // ignore stripe errors
    }
  }

  // 1.5) Si hay acuerdo en metadata, marcarlo como 'paid' (fallback cuando el webhook no está disponible)
  try {
    if (stripe && sessionId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      const agreementId = ((s?.metadata || {}) as Record<string, string | undefined>)["agreement_id"] || "";
      const agrId = (agreementId || "").trim();
      if (agrId) {
        const admin = supaAdmin();
        const agreementUpdate: AgreementsUpdate = { status: "paid" };
        try {
          await admin.from("agreements").update(agreementUpdate).eq("id", agrId);
        } catch {
          /* ignore */
        }
      }
    }
  } catch { /* ignore */ }

  // 2) Marcar la request como 'in_process' (idempotente). Si no hay env SRK, omite silenciosamente.
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = supaAdmin();
      // If we have requestId, mark in_process and set accepted pro/date/time; else try via offerId->conversation
      if (offerId && !offerServiceDate) {
        try {
          const { data: off } = await admin
            .from("offers")
            .select("service_date")
            .eq("id", offerId)
            .maybeSingle<{ service_date: string | null }>();
          if (off?.service_date) offerServiceDate = off.service_date;
        } catch {
          /* ignore */
        }
      }
      if (!requestId && offerId) {
        try {
          const { data: off } = await admin
            .from("offers")
            .select("conversation_id, service_date")
            .eq("id", offerId)
            .maybeSingle<{ conversation_id: string | null; service_date: string | null }>();
          const conv = off?.conversation_id ?? undefined;
          if (!offerServiceDate && off?.service_date) offerServiceDate = off.service_date;
          if (conv) {
            const { data: convRow } = await admin
              .from("conversations")
              .select("request_id")
              .eq("id", conv)
              .maybeSingle<{ request_id: string | null }>();
            requestId = convRow?.request_id ?? requestId;
          }
        } catch {
          /* ignore */
        }
      }
      if (requestId) {
        const patch: RequestsUpdate = { status: "in_process" };
        if (offerServiceDate) patch.required_at = offerServiceDate;
        if (proIdMeta) {
          patch.professional_id = proIdMeta;
          patch.accepted_professional_id = proIdMeta;
        } else if (conversationId) {
          try {
            const { data: conv } = await admin
              .from("conversations")
              .select("pro_id")
              .eq("id", conversationId)
              .maybeSingle<{ pro_id: string | null }>();
            const pid = conv?.pro_id ?? undefined;
            if (pid) {
              patch.professional_id = pid;
              patch.accepted_professional_id = pid;
            }
          } catch {
            /* ignore */
          }
        }
        if (scheduled_date) patch.scheduled_date = scheduled_date;
        if (scheduled_time) patch.scheduled_time = scheduled_time;
        try {
          if (!patch.scheduled_date) {
            try {
              const { data: r0 } = await admin
                .from("requests")
                .select("scheduled_date, required_at")
                .eq("id", requestId)
                .maybeSingle<{ scheduled_date: string | null; required_at: string | null }>();
              let sd: string | null = r0?.scheduled_date ?? null;
              if (!sd) sd = r0?.required_at ?? null;
              if (!sd) sd = new Date().toISOString().slice(0, 10);
              patch.scheduled_date = sd;
            } catch {
              /* ignore */
            }
          }
          await admin.from("requests").update(patch).eq("id", requestId);
        } catch {
          /* ignore */
        }
        // Mirror to pro calendar
        try {
          const proId = patch.accepted_professional_id ?? null;
          const { data: titleRow } = await admin
            .from("requests")
            .select("title")
            .eq("id", requestId)
            .maybeSingle<{ title: string | null }>();
          const title = titleRow?.title ?? "Servicio";
          if (proId) {
            const event: ProCalendarEventsInsert = {
              pro_id: proId,
              request_id: requestId,
              title,
              scheduled_date: scheduled_date ?? patch.scheduled_date ?? null,
              scheduled_time: scheduled_time ?? patch.scheduled_time ?? null,
              status: "scheduled",
            };
            await admin.from("pro_calendar_events").upsert(event, { onConflict: "request_id" });
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch { /* ignore */ }

  // 3) Calcular conversationId final para redirigir
  if (!conversationId && requestId) {
    try {
      const conv = await getConversationIdForRequest(requestId);
      if (conv) conversationId = conv;
    } catch {
      /* ignore */
    }
  }

  // 3.5) Marcar "paid" en el chat y adjuntar recibo PDF (best-effort)
  if (conversationId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = supaAdmin();
      // Insertar mensaje de pago confirmado si no existe
      if (offerId) {
        try {
          const { data: have } = await admin
            .from("messages")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("message_type", "system")
            .contains("payload", { offer_id: offerId, status: "paid" })
            .limit(1);
          if (!Array.isArray(have) || have.length === 0) {
            const { data: off } = await admin
              .from("offers")
              .select("client_id")
              .eq("id", offerId)
              .maybeSingle<{ client_id: string | null }>();
            const senderId = off?.client_id ?? undefined;
            if (senderId) {
              const payload: PaidNotificationPayload = { offer_id: offerId, status: "paid" };
              const messageInsert: MessagesInsert = {
                conversation_id: conversationId,
                sender_id: senderId,
                body: "Pago realizado. Servicio agendado.",
                message_type: "system",
                payload,
              };
              await admin.from("messages").insert(messageInsert);
              try {
                const { notifyChatMessageByConversation } = await import("@/lib/chat-notifier");
                await notifyChatMessageByConversation({
                  conversationId,
                  senderId,
                  text: "Pago realizado. Servicio agendado.",
                });
              } catch {
                /* ignore */
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
      // Intentar usar el recibo real (por checkout_session_id), con reintentos por retraso del webhook
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let dbReceiptId: string | null = null;
      if (sessionId) {
        for (let i = 0; i < 6; i++) {
          try {
            const { data: rec } = await admin
              .from("receipts")
              .select("id")
              .eq("checkout_session_id", sessionId)
              .maybeSingle<{ id: string | null }>();
            dbReceiptId = rec?.id ?? null;
            if (dbReceiptId) break;
          } catch {
            /* ignore */
          }
          await sleep(700);
        }
      }
      const receiptId = dbReceiptId || `RCPT-${sessionId || Date.now()}`;
      // Encontrar sender (cliente)
      const { data: convRow } = await admin
        .from("conversations")
        .select("customer_id")
        .eq("id", conversationId)
        .maybeSingle<{ customer_id: string }>();
      const senderId = convRow?.customer_id || null;
      if (senderId) {
        // Idempotencia: buscar/crear mensaje con este receiptId
        const { data: existingMessage } = await admin
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("message_type", "system")
          .contains("payload", { receipt_id: receiptId })
          .maybeSingle<{ id: string }>();
        let messageId: string | undefined = existingMessage?.id ?? undefined;
        if (!messageId) {
          const payload: ReceiptPayload = { receipt_id: receiptId, status: "receipt" };
          // Provide helpful URLs so UI can link even if attachment upload fails
          try {
            const baseUrl = url.origin;
            if (baseUrl) payload.download_url = `${baseUrl}/api/receipts/${encodeURIComponent(receiptId)}/pdf`;
          } catch {
            /* ignore */
          }
          const messageInsert: MessagesInsert = {
            conversation_id: conversationId,
            sender_id: senderId,
            body: "Recibo de pago adjunto",
            message_type: "system",
            payload,
          };
          const msgIns = await admin
            .from("messages")
            .insert(messageInsert)
            .select("id")
            .single<{ id: string }>();
          messageId = msgIns.data?.id ?? undefined;
        }

        // Generar PDF tras crear/obtener el mensaje (con pequeño reintento)
        let pdfBuffer: Buffer | null = null;
        try {
          const base = url.origin;
          const resPdf = await fetch(`${base}/api/receipts/${encodeURIComponent(receiptId)}/pdf`);
          if (resPdf.ok) {
            const arr = await resPdf.arrayBuffer();
            pdfBuffer = Buffer.from(arr);
          }
        } catch {
          pdfBuffer = null;
        }
        // retry una vez más tras breve espera, por si el webhook o la vista aún no reflejan la fila
        if (!pdfBuffer) {
          await sleep(700);
          try {
            const base = url.origin;
            const resPdf2 = await fetch(`${base}/api/receipts/${encodeURIComponent(receiptId)}/pdf`);
            if (resPdf2.ok) {
              const arr2 = await resPdf2.arrayBuffer();
              pdfBuffer = Buffer.from(arr2);
            }
          } catch { pdfBuffer = null; }
        }

        if (messageId && pdfBuffer) {
          const filePath = `conversation/${conversationId}/${messageId}/handi-recibo-${receiptId}.pdf`;
          const up = await admin.storage
            .from("message-attachments")
            .upload(filePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
          if (!up.error) {
            const attachment: MessageAttachmentsInsert = {
              message_id: messageId,
              conversation_id: conversationId,
              uploader_id: senderId,
              storage_path: filePath,
              filename: `handi-recibo-${receiptId}.pdf`,
              mime_type: "application/pdf",
              byte_size: pdfBuffer.length,
              width: null,
              height: null,
              sha256: null,
            };
            await admin.from("message_attachments").insert(attachment);
            // Best-effort: si usamos placeholder RCPT-cs_/pi_, intentar normalizar payload a la id real
            if (!dbReceiptId && sessionId) {
              try {
                const { data: rec2 } = await admin
                  .from("receipts")
                  .select("id")
                  .eq("checkout_session_id", sessionId)
                  .maybeSingle<{ id: string | null }>();
                const realId2 = rec2?.id ?? undefined;
                if (realId2 && realId2 !== receiptId) {
                  const payloadUpdate: MessagesInsert["payload"] = { receipt_id: realId2, status: "receipt" };
                  await admin
                    .from("messages")
                    .update({ payload: payloadUpdate })
                    .eq("id", messageId)
                    .eq("conversation_id", conversationId);
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 4) Revalidación y redirección al chat (o bandeja si no hay convId)
  try {
    if (requestId) revalidatePath(`/requests/${requestId}`);
    if (conversationId) revalidatePath(`/mensajes/${conversationId}`);
    revalidatePath('/pro/calendar');
    revalidateTag('pro-calendar');
  } catch { /* ignore */ }
  const target = conversationId ? `/mensajes/${conversationId}` : "/mensajes";
  return NextResponse.redirect(new URL(target, url.origin), { status: 302 });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
