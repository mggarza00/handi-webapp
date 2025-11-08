/* eslint-disable import/order */
import { NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipts';
import { sendEmail } from '@/lib/email';
import { getConversationIdForRequest } from '@/app/(app)/mensajes/_lib/getConversationForRequest';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { notifyChatMessageByConversation } from '@/lib/chat-notifier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function POST(req: Request, { params }: { params: { receiptId: string } }) {
  const url = new URL(req.url);
  const to = (url.searchParams.get('to') || '').trim();
  const data = await getReceipt(params.receiptId);
  if (!data) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404, headers: JSONH });
  const link = `${process.env.NEXT_PUBLIC_APP_URL || ''}/receipts/${encodeURIComponent(params.receiptId)}`;
  const total = (() => {
    if (typeof data.payment.amountMXN === 'number') {
      return data.payment.amountIsCents ? data.payment.amountMXN / 100 : data.payment.amountMXN;
    }
    return data.payment.total || 0;
  })();
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px">
    <img src="${data.business?.logoUrl || `${process.env.NEXT_PUBLIC_APP_URL || ''}/images/Logo-Handi-v2.gif`}" alt="${data.business?.name || 'Handi'}" height="40" style="height:40px" />
    <h1 style="font-size:20px;margin:16px 0 8px 0">Recibo de pago</h1>
    <p style="margin:4px 0;color:#6B7280">Folio: <strong>${data.receiptId}</strong></p>
    <p style="margin:4px 0;color:#6B7280">Cliente: <strong>${data.customer.name}</strong></p>
    <p style="margin:4px 0;color:#6B7280">Servicio: <strong>${data.service.title}</strong></p>
    <p style="margin:12px 0;font-size:24px;font-weight:700">${total.toFixed(2)} MXN</p>
    <p><a href="${link}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#2563EB;color:#fff;text-decoration:none">Ver recibo</a></p>
  </div>`;
  const subject = `Recibo ${params.receiptId} - ${data.service.title}`;
  const recipient = to || (data.customer?.email || '');
  if (!recipient) return NextResponse.json({ ok: false, error: 'MISSING_TO' }, { status: 400, headers: JSONH });
  // Generate PDF by calling the PDF endpoint (best-effort)
  let pdfBase64: string | null = null;
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || '';
    const pdfRes = await fetch(`${base}/api/receipts/${encodeURIComponent(params.receiptId)}/pdf`);
    if (pdfRes.ok) {
      const arr = await pdfRes.arrayBuffer();
      pdfBase64 = Buffer.from(arr).toString('base64');
    }
  } catch { pdfBase64 = null; }
  const attachments = pdfBase64 ? [{ filename: `handi-recibo-${params.receiptId}.pdf`, content: pdfBase64, mime: 'application/pdf' }] : undefined;
  const res = await sendEmail({ to: recipient, subject, html, attachments });
  if (!res.ok) {
    const errorStr = (res.error || '').toLowerCase();
    const isSandbox = errorStr.includes('validation_error') || errorStr.includes('you can only send testing emails');
    const serialized = res.details || (res.error ? { message: res.error } : { message: 'SEND_FAILED' });
    const body = isSandbox
      ? { ok: false, code: 'RESEND_SANDBOX_ERROR', hint: 'Tu dominio de envío debe estar verificado y el from debe usar ese dominio (p.ej. notificaciones@handi.mx).', error: serialized }
      : { ok: false, error: serialized };
    return NextResponse.json(body, { status: 400, headers: JSONH });
  }
  // Also attach into chat (best-effort)
  if (pdfBase64 && data.service.requestId) {
    try {
      const convId = await getConversationIdForRequest(data.service.requestId);
      if (convId) {
        const admin = getAdminSupabase();
        const { data: convRow } = await admin.from('conversations').select('customer_id').eq('id', convId).maybeSingle<{ customer_id: string }>();
        const senderId = convRow?.customer_id || null;
        if (senderId) {
          const payload: Record<string, unknown> = { receipt_id: params.receiptId, status: 'receipt' };
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
            if (baseUrl) (payload as any).download_url = `${baseUrl}/api/receipts/${encodeURIComponent(params.receiptId)}/pdf`;
          } catch { /* ignore */ }
          const msgIns = await admin
            .from('messages')
            .insert({ conversation_id: convId, sender_id: senderId, body: 'Recibo de pago adjunto', message_type: 'system', payload })
            .select('id')
            .single();
          const messageId = (msgIns.data as any)?.id as string | undefined;
          try { await notifyChatMessageByConversation({ conversationId: convId, senderId, text: 'Recibo de pago adjunto' }); } catch {}
          if (messageId) {
            const buffer = Buffer.from(pdfBase64, 'base64');
            const filePath = `conversation/${convId}/${messageId}/handi-recibo-${params.receiptId}.pdf`;
      const up = await admin.storage.from('message-attachments').upload(filePath, buffer, { contentType: 'application/pdf', upsert: true });
            if (!up.error) {
              await admin.from('message_attachments').insert({
                message_id: messageId,
                conversation_id: convId,
                uploader_id: senderId,
                storage_path: filePath,
                filename: `handi-recibo-${params.receiptId}.pdf`,
                mime_type: 'application/pdf',
                byte_size: buffer.length,
                width: null,
                height: null,
                sha256: null,
              });
            }
          }
        }
      }
    } catch { /* ignore chat attach failures */ }
  }
  return NextResponse.json({ ok: true, attached: Boolean(pdfBase64) }, { headers: JSONH });
}
