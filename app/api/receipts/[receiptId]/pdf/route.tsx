/* eslint-disable import/order */
import { NextResponse } from 'next/server';
import { getReceiptForPdf } from '@/lib/receipts';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { ReceiptTemplate } from '@/components/pdf/ReceiptTemplate';
import type { ServerReceipt } from '@/types/receipt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toPeso(cents?: number | null): number {
  const n = Number.isFinite(Number(cents)) ? Number(cents) : 0;
  return Math.round(((n / 100) + Number.EPSILON) * 100) / 100;
}

export async function GET(req: Request, { params }: { params: { receiptId: string } }) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const supabase = getAdminSupabase();
  const row = await getReceiptForPdf(supabase as any, params.receiptId);
  if (!row) return new NextResponse('Not found', { status: 404 });

  const servicio = toPeso((row as any).service_amount);
  const comision = toPeso((row as any).commission_amount);
  const iva = toPeso((row as any).iva_amount);
  let total = toPeso((row as any).total_amount);
  const sum = Math.round(((servicio + comision + iva) + Number.EPSILON) * 100) / 100;
  if (total !== sum) total = sum;

  const data: ServerReceipt = {
    receiptId: row.folio || params.receiptId,
    createdAtISO: row.created_at ?? new Date().toISOString(),
    customer: { name: row.client_name || '', email: row.client_email || '' },
    service: { title: row.service_title || 'Servicio', requestId: (row as any).request_id || '', professionalName: row.professional_name || '', dateISO: null },
    payment: {
      method: 'card', brand: null, last4: null,
      amountMXN: total, amountIsCents: false,
      items: [
        { description: 'Servicio', amount: servicio },
        { description: 'Comisión', amount: comision },
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
  };

  try {
    const pdfLib: any = await import('@react-pdf/renderer');
    const doc = <ReceiptTemplate data={data} baseUrl={base} />;
    const stream = await pdfLib.renderToStream(doc);
    const buf = await streamToBuffer(stream);
    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=handi-recibo-${params.receiptId}.pdf`,
      },
    });
  } catch {
    return new NextResponse('PDF unavailable (missing @react-pdf/renderer)', { status: 503 });
  }
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
