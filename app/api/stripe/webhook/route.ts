import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import React from 'react';
import { ReceiptTemplate } from '@/components/pdf/ReceiptTemplate';
import { getReceiptForPdf } from '@/lib/receipts';

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request) {
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_WEBHOOK_SECRET) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "SERVER_MISCONFIGURED:STRIPE_KEYS" }),
      { status: 500, headers: JSONH },
    );
  }
  const stripe = await getStripe();
  if (!stripe) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "SERVER_MISCONFIGURED:STRIPE_SECRET_KEY" }),
      { status: 500, headers: JSONH },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "MISSING_SIGNATURE" }),
      { status: 400, headers: JSONH },
    );
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid payload";
    return new NextResponse(
      JSON.stringify({ ok: false, error: "INVALID_SIGNATURE", detail: msg }),
      { status: 400, headers: JSONH },
    );
  }

  try {
    let requestIdTouched: string | null = null;
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
        if (url && serviceRole) {
          const admin = createClient(url, serviceRole);
          const offerId = (session.metadata?.offer_id || "").trim();
          const metadataType = ((session.metadata as any)?.type || "").trim();
          const onsiteIdMeta = ((session.metadata as any)?.onsite_quote_request_id || (session.metadata as any)?.onsite_request_id || "").trim();
          const requestIdFromMeta = (session.metadata?.request_id || (session.metadata as any)?.requestId || "").trim();
          const proIdFromMeta = ((session.metadata as any)?.proId || "").trim();
          const scheduledDateMeta = ((session.metadata as any)?.scheduled_date || "").trim();
          const scheduledTimeMeta = ((session.metadata as any)?.scheduled_time || "").trim();
          let payment_intent_id: string | null = typeof session.payment_intent === "string" ? session.payment_intent : null;
          let receipt_url: string | null = null;
          try {
            if (!receipt_url && payment_intent_id) {
              const pi = await stripe.paymentIntents.retrieve(payment_intent_id, { expand: ["latest_charge"] });
              const anyCharge: any = (pi as any)?.latest_charge || null;
              const r = typeof anyCharge?.receipt_url === "string" ? anyCharge.receipt_url : null;
              if (r) receipt_url = r;
            }
          } catch {}
          // Compute canonical receipt amounts in cents
          let total_cents = 0;
          let commission_cents = 0;
          let iva_cents = 0;
          let service_cents = 0;
          let currency: string = (session.currency || 'MXN').toUpperCase();
          try {
            if (payment_intent_id) {
              const pi = await stripe.paymentIntents.retrieve(payment_intent_id, { expand: ['latest_charge'] });
              const latestCharge: any = (pi as any)?.latest_charge || null;
              currency = (pi as any)?.currency?.toUpperCase?.() || currency;
              const appFee = Number(latestCharge?.application_fee_amount || 0);
              commission_cents = Number.isFinite(appFee) ? appFee : 0;
              let invoiceTax = 0;
              const invId: string | undefined = latestCharge?.invoice || undefined;
              if (invId) {
                try {
                  const inv = await stripe.invoices.retrieve(invId);
                  const taxFromArray = Array.isArray((inv as any).total_tax_amounts)
                    ? ((inv as any).total_tax_amounts as any[]).reduce((acc, ta) => acc + Number(ta.amount || 0), 0)
                    : 0;
                  invoiceTax = Number.isFinite(taxFromArray) ? taxFromArray : Number((inv as any).tax || 0);
                } catch {}
              }
              const sessTax = Number((session as any).total_details?.amount_tax || 0);
              iva_cents = (invoiceTax || 0) > 0 ? invoiceTax : (Number.isFinite(sessTax) ? sessTax : 0);
              const received = Number((pi as any).amount_received || (pi as any).amount || 0);
              total_cents = Number.isFinite(received) ? received : Number(session.amount_total || 0);
              if (!Number.isFinite(total_cents)) total_cents = 0;
              service_cents = Math.max(0, total_cents - commission_cents - iva_cents);
              const chargeReceipt = typeof latestCharge?.receipt_url === 'string' ? latestCharge.receipt_url : null;
              if (chargeReceipt) receipt_url = chargeReceipt;
            }
          } catch { /* ignore */ }
          // Fallback from session metadata (our own breakdown) if Stripe doesn't provide separate fee/tax
          try {
            const mc = Number((session.metadata as any)?.commission_cents ?? NaN);
            const mi = Number((session.metadata as any)?.iva_cents ?? NaN);
            const mb = Number((session.metadata as any)?.base_cents ?? NaN);
            const mt = Number((session.metadata as any)?.total_cents ?? NaN);
            if (Number.isFinite(mc) && commission_cents === 0) commission_cents = mc;
            if (Number.isFinite(mi) && iva_cents === 0) iva_cents = mi;
            // If both base and total are present, normalize service to base
            if (Number.isFinite(mb)) service_cents = mb;
            if (Number.isFinite(mt)) total_cents = mt;
          } catch { /* ignore */ }
          // As a last resort, compute breakdown from offer.amount if still missing
          if (offerId && (commission_cents === 0 || iva_cents === 0)) {
            try {
              const { data: offRow2 } = await (createClient(url!, serviceRole!))
                .from('offers')
                .select('amount')
                .eq('id', offerId)
                .maybeSingle();
              const baseAmount = Number((offRow2 as any)?.amount ?? NaN);
              const baseCents = Number.isFinite(baseAmount) && baseAmount > 0 ? Math.round(baseAmount * 100) : 0;
              if (baseCents > 0) {
                const feeC = Math.min(150000, Math.max(5000, Math.round(baseCents * 0.05)));
                const ivaC = Math.round((baseCents + feeC) * 0.16);
                commission_cents = commission_cents || feeC;
                iva_cents = iva_cents || ivaC;
                service_cents = baseCents;
                total_cents = service_cents + commission_cents + iva_cents;
              }
            } catch { /* ignore */ }
          }
          if (total_cents === 0) total_cents = Number(session.amount_total || 0) || 0;
          if (iva_cents === 0) {
            const sessTax2 = Number((session as any).total_details?.amount_tax || 0);
            iva_cents = Number.isFinite(sessTax2) ? sessTax2 : 0;
          }
          if (service_cents === 0 && total_cents > 0) {
            service_cents = Math.max(0, total_cents - commission_cents - iva_cents);
          }
          // Persist receipt & items (idempotent by checkout_session_id)
          let receiptIdPersist: string | null = null;
          try {
            const sessionId = session.id;
            const { data: existing } = await admin.from('receipts').select('id').eq('checkout_session_id', sessionId).limit(1);
            receiptIdPersist = Array.isArray(existing) && existing.length ? (existing[0] as any).id : null;
            let requestId: string | null = requestIdFromMeta || null;
            let clientId: string | null = null;
            let professionalId: string | null = null;
            if (offerId) {
              const { data: offRow } = await admin.from('offers').select('conversation_id, client_id, professional_id').eq('id', offerId).maybeSingle();
              const convId2 = (offRow as any)?.conversation_id as string | undefined;
              clientId = (offRow as any)?.client_id || null;
              professionalId = (offRow as any)?.professional_id || null;
              if (!requestId && convId2) {
                const { data: conv2 } = await admin.from('conversations').select('request_id').eq('id', convId2).maybeSingle();
                requestId = ((conv2 as any)?.request_id || null) as string | null;
              }
            }
            const record: any = {
              request_id: requestId,
              client_id: clientId,
              professional_id: professionalId,
              offer_id: offerId || null,
              checkout_session_id: session.id,
              payment_intent_id,
              currency,
              service_amount_cents: service_cents,
              commission_amount_cents: commission_cents,
              iva_amount_cents: iva_cents,
              total_amount_cents: total_cents,
              metadata: {},
            };
            if (receiptIdPersist) {
              await admin.from('receipts').update(record).eq('id', receiptIdPersist);
            } else {
              const ins = await admin.from('receipts').insert(record).select('id').single();
              receiptIdPersist = (ins.data as any)?.id || null;
            }
            if (receiptIdPersist) {
              const items: any[] = [
                { receipt_id: receiptIdPersist, item_type: 'service', amount_cents: service_cents },
                { receipt_id: receiptIdPersist, item_type: 'commission', amount_cents: commission_cents },
                { receipt_id: receiptIdPersist, item_type: 'iva', amount_cents: iva_cents },
              ];
              await admin.from('receipt_items').insert(items);
            }
          } catch { /* ignore */ }
          // Attach PDF to chat (idempotente)
          try {
            if (offerId) {
              const { data: off2 } = await admin.from('offers').select('conversation_id, client_id').eq('id', offerId).maybeSingle();
              const convIdAttach = (off2 as any)?.conversation_id as string | undefined;
              const senderIdAttach = (off2 as any)?.client_id as string | undefined;
              if (receiptIdPersist && convIdAttach && senderIdAttach) {
                // Ensure message exists (idempotent)
                const { data: haveMsg } = await admin
                  .from('messages')
                  .select('id')
                  .eq('conversation_id', convIdAttach)
                  .eq('message_type', 'system')
                  .contains('payload', { receipt_id: receiptIdPersist })
                  .limit(1);
                let messageId: string | undefined = Array.isArray(haveMsg) && haveMsg.length ? ((haveMsg[0] as any).id as string) : undefined;
                if (!messageId) {
                  const payload: Record<string, unknown> = {
                    receipt_id: receiptIdPersist,
                    status: 'receipt',
                  };
                  // Best-effort: provide helpful URLs so UI can render a link if attachment creation fails
                  try {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                    if (baseUrl) (payload as any).download_url = `${baseUrl}/api/receipts/${encodeURIComponent(receiptIdPersist)}/pdf`;
                  } catch { /* ignore */ }
                  if (receipt_url) (payload as any).receipt_url = receipt_url;
                  const insMsg = await admin
                    .from('messages')
                    .insert({ conversation_id: convIdAttach, sender_id: senderIdAttach, body: 'Recibo de pago adjunto', message_type: 'system', payload } as any)
                    .select('id')
                    .single();
                  try {
                    const { notifyChatMessageByConversation } = await import('@/lib/chat-notifier');
                    if (senderIdAttach && convIdAttach) {
                      await notifyChatMessageByConversation({ conversationId: convIdAttach, senderId: senderIdAttach, text: 'Recibo de pago adjunto' });
                    }
                  } catch { /* ignore */ }
                  messageId = (insMsg.data as any)?.id as string | undefined;
                }
                // Generate PDF (render interno usando la vista can�nica)
                let pdfBuffer: Buffer | null = null;
                try {
                  const row = await getReceiptForPdf(admin as any, receiptIdPersist);
                  if (row) {
                    const toPeso = (c?: number | null) => {
                      const n = Number.isFinite(Number(c)) ? Number(c) : 0;
                      return Math.round(((n / 100) + Number.EPSILON) * 100) / 100;
                    };
                    const servicio = toPeso((row as any).service_amount);
                    const comision = toPeso((row as any).commission_amount);
                    const iva = toPeso((row as any).iva_amount);
                    let total = toPeso((row as any).total_amount);
                    const sum = Math.round(((servicio + comision + iva) + Number.EPSILON) * 100) / 100;
                    if (total !== sum) total = sum;
                    const data = {
                      receiptId: row.folio || receiptIdPersist,
                      createdAtISO: row.created_at ?? new Date().toISOString(),
                      customer: { name: row.client_name || '', email: row.client_email || '' },
                      service: { title: row.service_title || 'Servicio', requestId: (row as any).request_id || '', professionalName: row.professional_name || '', dateISO: null },
                      payment: {
                        method: 'card', brand: null, last4: null,
                        amountMXN: total, amountIsCents: false,
                        items: [
                          { description: 'Servicio', amount: servicio },
                          { description: 'Comisi�n', amount: comision },
                          { description: 'IVA', amount: iva },
                        ],
                        subtotal: servicio,
                        tax: iva,
                        total,
                        currency: (row as any).currency || 'MXN',
                        notes: null, paymentIntentId: null, sessionId: null,
                      },
                      business: { name: 'Handi', website: null, legalName: null, rfc: null, taxInfo: null, logoUrl: null, address: null, addressText: null, supportEmail: null, supportPhone: null },
                      meta: row.service_description ? { service_description: row.service_description } : null,
                    } as any;
                    const pdfLib: any = await import('@react-pdf/renderer');
                    const doc = (React.createElement(ReceiptTemplate, { data, baseUrl: process.env.NEXT_PUBLIC_APP_URL || '' }) as any);
                    const stream = await pdfLib.renderToStream(doc);
                    const chunks: Buffer[] = [];
                    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
                    pdfBuffer = Buffer.concat(chunks);
                  }
                } catch { pdfBuffer = null; }
                if (messageId && pdfBuffer) {
                  const filePath = `conversation/${convIdAttach}/${messageId}/handi-recibo-${receiptIdPersist}.pdf`;
                  const up = await admin.storage
                    .from('message-attachments')
                    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
                  if (!up.error) {
                    await admin.from('message_attachments').insert({
                      message_id: messageId,
                      conversation_id: convIdAttach,
                      uploader_id: senderIdAttach,
                      storage_path: filePath,
                      filename: `handi-recibo-${receiptIdPersist}.pdf`,
                      mime_type: 'application/pdf',
                      byte_size: pdfBuffer.length,
                      width: null,
                      height: null,
                      sha256: null,
                    } as any);
                  }
                }
              }
            }
          } catch { /* ignore */ }
          if (metadataType === 'onsite_deposit' && onsiteIdMeta) {
            // Depósito de cotización en sitio
            try {
              await admin
                .from('onsite_quote_requests')
                .update({ status: 'deposit_paid', deposit_payment_intent_id: payment_intent_id })
                .eq('id', onsiteIdMeta)
                .in('status', ['deposit_pending','requested']);
            } catch { /* ignore */ }
            try {
              // Best-effort to revalidate chat
              const { data: row } = await admin.from('onsite_quote_requests').select('conversation_id').eq('id', onsiteIdMeta).maybeSingle();
              const convId = (row as any)?.conversation_id as string | undefined;
              if (convId) { try { revalidatePath(`/mensajes/${convId}`); } catch { /* ignore */ } }
            } catch { /* ignore */ }
          }

          if (offerId) {
            console.log(
              JSON.stringify({
                type: "stripe.checkout.session.completed",
                offerId,
                sessionId: session.id,
              }),
            );
            await admin
              .from("offers")
              .update({
                status: "paid",
                payment_intent_id,
                accepting_at: null,
              })
              .eq("id", offerId)
              .in("status", ["accepted", "pending"]);
            // Mensaje en chat (idempotente)
            try {
              const { data: off } = await admin.from("offers").select("id, conversation_id, client_id, professional_id, service_date").eq("id", offerId).single();
              const convId = (off as any)?.conversation_id as string | undefined;
              const clientId = (off as any)?.client_id as string | undefined;
              const proId = (off as any)?.professional_id as string | undefined;
              const serviceDateIso = (off as any)?.service_date as string | null;
              if (convId && clientId) {
                const { data: existing } = await admin
                  .from("messages")
                  .select("id")
                  .eq("conversation_id", convId)
                  .eq("message_type", "system")
                  .contains("payload", { offer_id: offerId, status: "paid" })
                  .limit(1);
                const hasPaid = Array.isArray(existing) && existing.length > 0;
                if (!hasPaid) {
                  const payload: Record<string, unknown> = { offer_id: offerId, status: "paid" };
                  if (receipt_url) payload.receipt_url = receipt_url;
                  // Prefer explicit date/time from metadata; fallback to offer.service_date
                  let whenStr: string | null = null;
                  if (scheduledDateMeta) whenStr = `${scheduledDateMeta}${scheduledTimeMeta ? ` ${scheduledTimeMeta}` : ""}`;
                  else if (serviceDateIso) {
                    try {
                      const dt = new Date(serviceDateIso);
                      const y = dt.toISOString().slice(0, 10);
                      const t = dt.toISOString().slice(11, 16);
                      whenStr = `${y} ${t}`;
                    } catch { /* ignore */ }
                  }
                  const paidBody = whenStr
                    ? `Pago confirmado. Servicio agendado para ${whenStr}`
                    : "Pago realizado. Servicio agendado.";
                  await admin
                    .from("messages")
                    .insert({
                      conversation_id: convId,
                      sender_id: clientId,
                      body: paidBody,
                      message_type: "system",
                      payload,
                    });
                }
                // Programa solicitud y envía dirección + mapa + horario al profesional
                try {
                  // Obtener request_id de la conversación
                  const { data: conv } = await admin.from("conversations").select("request_id").eq("id", convId).single();
                  const requestId = (conv as any)?.request_id as string | undefined;
                  if (requestId) {
                    requestIdTouched = requestId;
                    // Actualiza estado a in_process, pro asignado y fecha/hora
                    let patch: Record<string, unknown> = { status: "in_process", is_explorable: false, visible_in_explore: false } as any;
                    if (proId) {
                      try { (patch as any).professional_id = proId; } catch {}
                      try { (patch as any).accepted_professional_id = proId; } catch {}
                    }
                    if (scheduledDateMeta) {
                      (patch as any).scheduled_date = scheduledDateMeta;
                      if (scheduledTimeMeta) (patch as any).scheduled_time = scheduledTimeMeta as any;
                    } else if (serviceDateIso) {
                      try {
                        const dt = new Date(serviceDateIso);
                        const y = dt.toISOString().slice(0,10);
                        const time = dt.toISOString().slice(11,16);
                        (patch as any).scheduled_date = y;
                        (patch as any).scheduled_time = time as any;
                      } catch { /* ignore parse */ }
                    }
                    try {
                      if (!(patch as any).scheduled_date) {
                        try {
                          const { data: r0 } = await admin
                            .from('requests')
                            .select('scheduled_date, required_at')
                            .eq('id', requestId)
                            .maybeSingle();
                          let sd: string | null = (r0 as any)?.scheduled_date || null;
                          if (!sd) sd = (r0 as any)?.required_at || null;
                          if (!sd) sd = new Date().toISOString().slice(0, 10);
                          (patch as any).scheduled_date = sd;
                        } catch { /* ignore */ }
                      }
                      await admin.from("requests").update(patch).eq("id", requestId);
                    } catch { /* ignore */ }
                    // Lee dirección y arma mensaje detallado
                    const { data: reqRow } = await admin
                      .from("requests")
                      .select("title,address_line,address_place_id,address_lat,address_lng,scheduled_date,scheduled_time")
                      .eq("id", requestId)
                      .single();
                    const address_line = (reqRow as any)?.address_line as string | null;
                    const address_lat = (reqRow as any)?.address_lat as number | null;
                    const address_lng = (reqRow as any)?.address_lng as number | null;
                    const scheduled_date = (reqRow as any)?.scheduled_date as string | null;
                    const scheduled_time = (reqRow as any)?.scheduled_time as string | null;
                    const reqTitle = ((reqRow as any)?.title as string | undefined) || "Servicio";
                    // Upsert calendar event (best effort)
                    try {
                      if (proId) {
                        await (admin as any)
                          .from('pro_calendar_events')
                          .upsert({
                            pro_id: proId,
                            request_id: requestId,
                            title: reqTitle,
                            scheduled_date: scheduled_date || scheduledDateMeta || null,
                            scheduled_time: scheduled_time || (scheduledTimeMeta as any) || null,
                            status: 'scheduled',
                          }, { onConflict: 'request_id' });
                      }
                    } catch { /* ignore calendar errors */ }
                    const mapsUrl = address_lat != null && address_lng != null
                      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address_lat},${address_lng}`)}`
                      : (address_line ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address_line)}` : null);
                    const pubToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
                    const mapImg = pubToken && address_lat != null && address_lng != null
                      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l+ff0000(${address_lng},${address_lat})/${address_lng},${address_lat},15/600x300@2x?access_token=${encodeURIComponent(pubToken)}`
                      : null;
                    const whenStr = scheduled_date
                      ? `${scheduled_date}${scheduled_time ? ` ${scheduled_time}` : ""}`
                      : (serviceDateIso || null);
                    const body = [
                      address_line ? `Dirección: ${address_line}` : null,
                      whenStr ? `Día y horario: ${whenStr}` : null,
                      mapsUrl ? `Abrir en Google Maps: ${mapsUrl}` : null,
                    ].filter(Boolean).join("\n");
                    const payload2: Record<string, unknown> = {
                      offer_id: offerId,
                      type: "schedule_details",
                      address_line,
                      coords: address_lat != null && address_lng != null ? { lat: address_lat, lng: address_lng } : null,
                      map_image_url: mapImg,
                      maps_url: mapsUrl,
                      scheduled_date,
                      scheduled_time,
                    };
                    await admin
                      .from("messages")
                      .insert({ conversation_id: convId, sender_id: clientId, body: body || "Detalles de servicio", message_type: "system", payload: payload2 });
                    try {
                      const { notifyChatMessageByConversation } = await import('@/lib/chat-notifier');
                      if (convId && clientId) {
                        await notifyChatMessageByConversation({ conversationId: convId, senderId: clientId, text: body || 'Detalles de servicio' });
                      }
                    } catch { /* ignore */ }
                    try { revalidatePath('/pro/calendar'); revalidateTag('pro-calendar'); revalidatePath(`/mensajes/${convId}`); } catch { /* ignore */ }
                  }
                } catch {}
              }
            } catch {}
          }

          const agreementId = (session.metadata?.agreement_id || "").trim();
          if (agreementId) {
            const { data: agr } = await admin
              .from("agreements")
              .update({ status: "paid" })
              .eq("id", agreementId)
              .select("id, request_id")
              .single();
            if (agr?.request_id) {
              requestIdTouched = agr.request_id as any;
              try {
                await admin
                  .from("requests")
                  // Idempotente: marca como in_process
                  .update({ status: "in_process" as any, is_explorable: false as any, visible_in_explore: false as any })
                  .eq("id", agr.request_id);
              } catch { /* ignore */ }
              // Enviar mensaje con dirección si existe conversación
              try {
                const { data: agrRow } = await admin
                  .from("agreements")
                  .select("id, professional_id, request_id")
                  .eq("id", agreementId)
                  .single();
                const proId = (agrRow as any)?.professional_id as string | undefined;
                let convId: string | null = null;
                if (proId) {
                  const { data: conv } = await admin
                    .from("conversations")
                    .select("id")
                    .eq("request_id", agr.request_id)
                    .eq("pro_id", proId)
                    .limit(1);
                  if (Array.isArray(conv) && conv.length) convId = (conv[0] as any).id as string;
                }
                const { data: reqRow } = await admin
                  .from("requests")
                  .select("title,created_by,address_line,address_place_id,address_lat,address_lng,scheduled_date,scheduled_time")
                  .eq("id", agr.request_id)
                  .single();
                const clientId = (reqRow as any)?.created_by as string | undefined;
                if (convId && clientId) {
                  const address_line = (reqRow as any)?.address_line as string | null;
                  const address_lat = (reqRow as any)?.address_lat as number | null;
                  const address_lng = (reqRow as any)?.address_lng as number | null;
                  const scheduled_date = (reqRow as any)?.scheduled_date as string | null;
                  const scheduled_time = (reqRow as any)?.scheduled_time as string | null;
                  const reqTitle = ((reqRow as any)?.title as string | undefined) || "Servicio";
                  // Upsert calendar event (best effort)
                  try {
                    if (proId) {
                      await (admin as any)
                        .from('pro_calendar_events')
                        .upsert({
                          pro_id: proId,
                          request_id: agr.request_id,
                          title: reqTitle,
                          scheduled_date: scheduled_date || null,
                          scheduled_time: scheduled_time || null,
                          status: 'scheduled',
                        }, { onConflict: 'request_id' });
                    }
                  } catch { /* ignore calendar errors */ }
                  const mapsUrl = address_lat != null && address_lng != null
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address_lat},${address_lng}`)}`
                    : (address_line ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address_line)}` : null);
                  const pubToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
                  const mapImg = pubToken && address_lat != null && address_lng != null
                    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l+ff0000(${address_lng},${address_lat})/${address_lng},${address_lat},15/600x300@2x?access_token=${encodeURIComponent(pubToken)}`
                    : null;
                  const whenStr = scheduled_date
                    ? `${scheduled_date}${scheduled_time ? ` ${scheduled_time}` : ""}`
                    : null;
                  const body = [
                    address_line ? `Dirección: ${address_line}` : null,
                    whenStr ? `Día y horario: ${whenStr}` : null,
                    mapsUrl ? `Abrir en Google Maps: ${mapsUrl}` : null,
                  ].filter(Boolean).join("\n");
                  const payload2: Record<string, unknown> = {
                    agreement_id: agreementId,
                    type: "schedule_details",
                    address_line,
                    coords: address_lat != null && address_lng != null ? { lat: address_lat, lng: address_lng } : null,
                    map_image_url: mapImg,
                    maps_url: mapsUrl,
                    scheduled_date,
                    scheduled_time,
                  };
                  await admin
                    .from("messages")
                    .insert({ conversation_id: convId, sender_id: clientId, body: body || "Detalles de servicio", message_type: "system", payload: payload2 });
                  try { revalidatePath('/pro/calendar'); revalidateTag('pro-calendar'); revalidatePath(`/mensajes/${convId}`); } catch { /* ignore */ }
                }
              } catch {}
            }
          }

          // Manejo directo por request_id en metadata (flujo de checkout general)
          if (!offerId && requestIdFromMeta) {
            try {
              requestIdTouched = requestIdFromMeta;
              const patchReq: Record<string, unknown> = { status: "in_process" as any, is_explorable: false as any, visible_in_explore: false as any };
              if (proIdFromMeta) {
                (patchReq as any).professional_id = proIdFromMeta;
                (patchReq as any).accepted_professional_id = proIdFromMeta;
              }
              if (scheduledDateMeta) {
                (patchReq as any).scheduled_date = scheduledDateMeta;
                if (scheduledTimeMeta) (patchReq as any).scheduled_time = scheduledTimeMeta as any;
              }
              try {
                if (!(patchReq as any).scheduled_date) {
                  const { data: r0 } = await admin
                    .from('requests')
                    .select('scheduled_date, required_at')
                    .eq('id', requestIdFromMeta)
                    .maybeSingle();
                  let sd: string | null = (r0 as any)?.scheduled_date || null;
                  if (!sd) sd = (r0 as any)?.required_at || null;
                  if (!sd) sd = new Date().toISOString().slice(0, 10);
                  (patchReq as any).scheduled_date = sd;
                }
                await admin
                  .from("requests")
                  .update(patchReq)
                  .eq("id", requestIdFromMeta);
              } catch { /* ignore */ }

              // Busca conversación asociada y arma mensaje al pro
              const { data: convs } = await admin
                .from("conversations")
                .select("id, customer_id, pro_id")
                .eq("request_id", requestIdFromMeta)
                .order("created_at", { ascending: false })
                .limit(1);
              const convId = Array.isArray(convs) && convs.length ? (convs[0] as any).id as string : null;
              const { data: reqRow } = await admin
                .from("requests")
                .select("title,created_by,address_line,address_place_id,address_lat,address_lng,scheduled_date,scheduled_time")
                .eq("id", requestIdFromMeta)
                .single();
              const clientId = (reqRow as any)?.created_by as string | undefined;
              if (convId && clientId) {
                const address_line = (reqRow as any)?.address_line as string | null;
                const address_lat = (reqRow as any)?.address_lat as number | null;
                const address_lng = (reqRow as any)?.address_lng as number | null;
                const scheduled_date = (reqRow as any)?.scheduled_date as string | null;
                const scheduled_time = (reqRow as any)?.scheduled_time as string | null;
                const reqTitle = ((reqRow as any)?.title as string | undefined) || "Servicio";
                // Upsert calendar event
                try {
                  const proId = proIdFromMeta || (Array.isArray(convs) && convs.length ? (convs[0] as any).pro_id as string | undefined : undefined);
                  if (proId) {
                    await (admin as any)
                      .from('pro_calendar_events')
                      .upsert({
                        pro_id: proId,
                        request_id: requestIdFromMeta,
                        title: reqTitle,
                        scheduled_date: scheduled_date || scheduledDateMeta || null,
                        scheduled_time: scheduled_time || (scheduledTimeMeta as any) || null,
                        status: 'scheduled',
                      }, { onConflict: 'request_id' });
                  }
                } catch { /* ignore calendar errors */ }
                const mapsUrl = address_lat != null && address_lng != null
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address_lat},${address_lng}`)}`
                  : (address_line ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address_line)}` : null);
                const pubToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
                const mapImg = pubToken && address_lat != null && address_lng != null
                  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l+ff0000(${address_lng},${address_lat})/${address_lng},${address_lat},15/600x300@2x?access_token=${encodeURIComponent(pubToken)}`
                  : null;
                const whenStr = scheduled_date
                  ? `${scheduled_date}${scheduled_time ? ` ${scheduled_time}` : ""}`
                  : null;
                // Confirmation message
                try {
                  const paidBody = whenStr ? `Pago confirmado. Servicio agendado para ${whenStr}` : 'Pago realizado. Servicio agendado.';
                  await admin.from('messages').insert({ conversation_id: convId, sender_id: clientId, body: paidBody, message_type: 'system', payload: { request_id: requestIdFromMeta, status: 'paid' } } as any);
                  try {
                    const { notifyChatMessageByConversation } = await import('@/lib/chat-notifier');
                    if (convId && clientId) {
                      await notifyChatMessageByConversation({ conversationId: convId, senderId: clientId, text: paidBody });
                    }
                  } catch { /* ignore */ }
                } catch { /* ignore */ }
                const body = [
                  address_line ? `Dirección: ${address_line}` : null,
                  whenStr ? `Día y horario: ${whenStr}` : null,
                  mapsUrl ? `Abrir en Google Maps: ${mapsUrl}` : null,
                ].filter(Boolean).join("\\n");
                const payload2: Record<string, unknown> = {
                  type: "schedule_details",
                  address_line,
                  coords: address_lat != null && address_lng != null ? { lat: address_lat, lng: address_lng } : null,
                  map_image_url: mapImg,
                  maps_url: mapsUrl,
                  scheduled_date,
                  scheduled_time,
                };
                await admin
                  .from("messages")
                  .insert({ conversation_id: convId, sender_id: clientId, body: body || "Detalles de servicio", message_type: "system", payload: payload2 });
                try {
                  const { notifyChatMessageByConversation } = await import('@/lib/chat-notifier');
                  if (convId && clientId) {
                    await notifyChatMessageByConversation({ conversationId: convId, senderId: clientId, text: body || 'Detalles de servicio' });
                  }
                } catch { /* ignore */ }
                try { revalidatePath('/pro/calendar'); revalidateTag('pro-calendar'); revalidatePath(`/mensajes/${convId}`); } catch { /* ignore */ }
              }
            } catch {}
          }

        }
        break;
      }
      case "payment_intent.payment_failed": {
        // TODO: logging/alertas
        break;
      }
      default:
        break;
    }

    // Best-effort cache revalidation for explore list, request detail and pro calendar
    try {
      revalidatePath('/requests/explore');
      if (requestIdTouched) revalidatePath(`/requests/${requestIdTouched}`);
      revalidatePath('/pro/calendar');
      revalidateTag('pro-calendar');
    } catch {}
    return NextResponse.json(
      { ok: true, received: true, type: event.type },
      { status: 200, headers: JSONH },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new NextResponse(
      JSON.stringify({ ok: false, error: "WEBHOOK_HANDLER_ERROR", detail: msg }),
      { status: 500, headers: JSONH },
    );
  }
}

export function GET() {
  return new NextResponse(
    JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }),
    { status: 405, headers: JSONH },
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
