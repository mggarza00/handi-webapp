import PageActions from "@/components/receipts/PageActions.client";
import * as React from 'react';
import Receipt from '@/components/receipts/Receipt';
import { getReceipt } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

export default async function ReceiptDemoPage() {
  const data = await getReceipt('DEMO-123');
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageActions id='DEMO-123' />
      {data ? <Receipt data={data} /> : <div className="p-6 text-sm text-gray-600">No se pudo cargar la demo.</div>}
    </main>
  );
}
