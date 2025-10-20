/* eslint-disable import/order */
import * as React from 'react';
import Receipt, { type ReceiptData } from '@/components/receipt/Receipt';
import ReceiptActions from '@/components/receipt/ReceiptActions.client';
import type { ServerReceipt } from '@/types/receipt';
import { toReceiptData } from '@/lib/receipt-map';

export const dynamic = 'force-dynamic';

async function fetchReceipt(id: string): Promise<ReceiptData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/receipts/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as { data?: unknown } | null;
    const raw = json?.data as unknown;
    if (!raw) return null;
    // Try ServerReceipt, then ReceiptData
    const sr = raw as ServerReceipt;
    if (typeof sr?.receiptId === 'string' && typeof sr?.createdAtISO === 'string') {
      return toReceiptData(sr);
    }
    return raw as ReceiptData;
  } catch {
    return null;
  }
}

function fallbackData(id: string): ReceiptData {
  const now = new Date().toISOString();
  return {
    id,
    created_at: now,
    customer_name: 'Cliente',
    customer_email: null,
    customer_phone: null,
    provider_name: 'Profesional',
    request_title: 'Servicio',
    service_date: now,
    payment_method: 'Tarjeta (**** **** **** 4242)',
    items: [
      { description: 'Servicio contratado', quantity: 1, unit_price: 500, amount: 500 },
    ],
    subtotal: 500,
    tax: 0,
    total: 500,
    notes: null,
  };
}

export default async function ReciboPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const data = (await fetchReceipt(id)) ?? fallbackData(id);
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-3">
        <ReceiptActions />
      </div>
      <Receipt data={data} />
    </main>
  );
}
