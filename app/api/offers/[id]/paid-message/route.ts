import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { notifyChatMessageByConversation } from "@/lib/chat-notifier";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { createClient as createServerClient } from "@/utils/supabase/server";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const offerId = (params?.id || "").trim();
    if (!offerId)
      return NextResponse.json(
        { ok: false, error: "MISSING_OFFER" },
        { status: 400, headers: JSONH },
      );

    const db = createServerClient();
    const { data: auth } = await db.auth.getUser();
    const userId = auth?.user?.id || null;
    if (!userId)
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401, headers: JSONH },
      );

    const { data: offer, error } = await db
      .from("offers")
      .select(
        "id, conversation_id, client_id, professional_id, status, payment_intent_id",
      )
      .eq("id", offerId)
      .single();
    if (error || !offer)
      return NextResponse.json(
        { ok: false, error: "OFFER_NOT_FOUND" },
        { status: 404, headers: JSONH },
      );
    if (offer.client_id !== userId && offer.professional_id !== userId)
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      );

    const convId = offer.conversation_id as string | null;
    if (!convId)
      return NextResponse.json(
        { ok: false, error: "MISSING_CONVERSATION" },
        { status: 400, headers: JSONH },
      );
    if (String(offer.status).toLowerCase() !== "paid")
      return NextResponse.json(
        { ok: false, status: offer.status },
        { status: 200, headers: JSONH },
      );

    const admin = getAdminSupabase();
    const msgClient = (admin ?? db) as any;
    let requestId: string | null = null;
    let requestTitle: string | null = null;
    let addressLine: string | null = null;
    let city: string | null = null;
    let proId: string | null = (offer as any)?.professional_id ?? null;
    let clientId: string | null = (offer as any)?.client_id ?? null;

    if (admin && convId) {
      try {
        const { data: conv } = await admin
          .from("conversations")
          .select("request_id, customer_id, pro_id")
          .eq("id", convId)
          .maybeSingle();
        requestId = (conv as any)?.request_id ?? null;
        if (!clientId) clientId = (conv as any)?.customer_id ?? null;
        if (!proId) proId = (conv as any)?.pro_id ?? null;
      } catch {
        /* ignore */
      }
    }
    if (admin && requestId) {
      try {
        const { data: req } = await admin
          .from("requests")
          .select("title, address_line, city")
          .eq("id", requestId)
          .maybeSingle();
        requestTitle = (req as any)?.title ?? null;
        addressLine = (req as any)?.address_line ?? null;
        city = (req as any)?.city ?? null;
      } catch {
        /* ignore */
      }
    }

    let receiptId: string | null = null;
    let receiptUrl: string | null = null;
    let downloadUrl: string | null = null;
    try {
      if (admin) {
        const { data: recByOffer } = await admin
          .from("receipts")
          .select("id")
          .eq("offer_id", offerId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (Array.isArray(recByOffer) && recByOffer.length) {
          receiptId = (recByOffer[0] as any)?.id ?? null;
        }
        if (!receiptId) {
          const piId = (offer as any)?.payment_intent_id as string | null;
          if (piId) {
            const { data: recByPi } = await admin
              .from("receipts")
              .select("id")
              .eq("payment_intent_id", piId)
              .order("created_at", { ascending: false })
              .limit(1);
            if (Array.isArray(recByPi) && recByPi.length) {
              receiptId = (recByPi[0] as any)?.id ?? null;
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
    if (receiptId) {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      downloadUrl = `${base.replace(/\/$/, "")}/api/receipts/${encodeURIComponent(
        receiptId,
      )}/pdf`;
    }
    if (!receiptUrl) {
      try {
        const piId = (offer as any)?.payment_intent_id as string | null;
        const stripe = await getStripe();
        if (stripe && piId) {
          const pi = await stripe.paymentIntents.retrieve(piId, {
            expand: ["latest_charge"],
          });
          const anyCharge: any = (pi as any)?.latest_charge || null;
          const rec =
            typeof anyCharge?.receipt_url === "string"
              ? anyCharge.receipt_url
              : null;
          if (rec) receiptUrl = rec;
        }
      } catch {
        /* ignore */
      }
    }

    const hasSystemMessage = async (match: Record<string, unknown>) => {
      const { data: existing } = await msgClient
        .from("messages")
        .select("id")
        .eq("conversation_id", convId)
        .eq("message_type", "system")
        .contains("payload", match)
        .limit(1);
      return Array.isArray(existing) && existing.length > 0;
    };

    const senderId = clientId || userId;
    let created = false;
    const paidPayload: Record<string, unknown> = {
      offer_id: offerId,
      status: "paid",
    };
    if (!(await hasSystemMessage(paidPayload))) {
      await msgClient.from("messages").insert({
        conversation_id: convId,
        sender_id: senderId,
        body: "Pago realizado. Servicio agendado.",
        message_type: "system",
        payload: paidPayload,
      });
      created = true;
      // Aviso por email
      try {
        await notifyChatMessageByConversation({
          conversationId: convId,
          senderId,
          text: "Pago realizado. Servicio agendado.",
        });
      } catch {
        /* ignore */
      }
    }

    const addressLineStr = addressLine?.toString().trim() || "";
    const cityStr = city?.toString().trim() || "";
    if (addressLineStr || cityStr) {
      const addressPayload: Record<string, unknown> = {
        offer_id: offerId,
        status: "paid",
        type: "service_scheduled_address",
        address_line: addressLineStr || null,
        city: cityStr || null,
      };
      const hasAddress = await hasSystemMessage({
        offer_id: offerId,
        status: "paid",
        type: "service_scheduled_address",
      });
      if (!hasAddress) {
        const line = [addressLineStr, cityStr].filter(Boolean).join(", ");
        await msgClient.from("messages").insert({
          conversation_id: convId,
          sender_id: senderId,
          body: line ? `Servicio agendado en ${line}.` : "Servicio agendado.",
          message_type: "system",
          payload: addressPayload,
        });
      }
    }

    if (receiptId || receiptUrl) {
      let hasReceipt = false;
      if (receiptId) {
        hasReceipt = await hasSystemMessage({ receipt_id: receiptId });
      }
      if (!hasReceipt) {
        hasReceipt = await hasSystemMessage({
          offer_id: offerId,
          status: "paid",
          type: "payment_receipt",
        });
      }
      if (!hasReceipt) {
        const receiptPayload: Record<string, unknown> = {
          offer_id: offerId,
          status: "paid",
          type: "payment_receipt",
        };
        if (receiptId) receiptPayload.receipt_id = receiptId;
        if (downloadUrl) receiptPayload.download_url = downloadUrl;
        if (receiptUrl) receiptPayload.receipt_url = receiptUrl;
        await msgClient.from("messages").insert({
          conversation_id: convId,
          sender_id: senderId,
          body: "Comprobante de pago",
          message_type: "system",
          payload: receiptPayload,
        });
      }
    }

    if (admin && proId) {
      try {
        const base =
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          "http://localhost:3000";
        const link = `${base.replace(/\/$/, "")}/mensajes/${encodeURIComponent(
          convId,
        )}`;
        const line = [addressLineStr, cityStr].filter(Boolean).join(", ");
        const body = line
          ? `La oferta fue pagada. Servicio agendado en ${line}.`
          : "La oferta fue pagada. Servicio agendado.";
        const { data: existingNotif } = await admin
          .from("user_notifications")
          .select("id")
          .eq("user_id", proId)
          .eq("type", "contract_offer_paid")
          .eq("link", link)
          .limit(1);
        const hasNotif =
          Array.isArray(existingNotif) && existingNotif.length > 0;
        if (!hasNotif) {
          await (admin as any).from("user_notifications").insert({
            user_id: proId,
            type: "contract_offer_paid",
            title: "Oferta pagada",
            body,
            link,
          });
          try {
            const { data: proUser } = await admin.auth.admin.getUserById(proId);
            const email = proUser?.user?.email ?? null;
            if (email) {
              const safeTitle = (requestTitle || "Servicio")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;");
              const addressHtml = line
                ? `<p><strong>Dirección:</strong> ${line
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")}</p>`
                : "";
              const html = `
                <p>Tu oferta de contratacion (<strong>${safeTitle}</strong>) ha sido pagada.</p>
                <p>El servicio se ha agendado.</p>
                ${addressHtml}
                <p><a href="${link}">Abrir chat</a></p>
              `;
              await sendEmail({
                to: email,
                subject: "Handi - Oferta pagada",
                html,
              }).catch(() => null);
            }
          } catch {
            /* ignore email */
          }
        }
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json(
      { ok: true, created, receiptUrl, receiptId, downloadUrl },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: JSONH },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
