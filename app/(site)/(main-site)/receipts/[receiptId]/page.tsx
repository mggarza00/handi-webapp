/* eslint-disable import/order */
import * as React from 'react';
import Receipt from '@/components/receipts/Receipt';
import { getReceipt } from '@/lib/receipts';
import PageActions from '@/components/receipts/PageActions.client';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: { receiptId: string } }) {
  const data = await getReceipt(params.receiptId);
  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="text-sm text-gray-600">Recibo no encontrado.</div>
        <div className="mt-2 text-sm text-blue-600"><Link href="/receipts/demo">Ver demo</Link></div>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageActions id={params.receiptId} />
      <Receipt data={data} />
    </main>
  );
}
