/* eslint-disable import/order */
import * as React from 'react';
import Link from 'next/link';
import { formatMXN, formatDateMX } from '@/lib/format';
import type { ServerReceipt } from '@/types/receipt';
import { toReceiptData } from '@/lib/receipt-map';

type Props = { data: ServerReceipt };

export default async function Receipt({ data: src }: Props) {
  const d = toReceiptData(src);
  const receiptUrl = `/receipts/${encodeURIComponent(d.id)}`;
  let qrSrc: string | null = null;
  try {
    const qrcode = (await import('qrcode')) as unknown as { toDataURL: (text: string, opts?: { margin?: number; width?: number }) => Promise<string> };
    const fullUrl = (process.env.NEXT_PUBLIC_APP_URL || '') + receiptUrl;
    qrSrc = await qrcode.toDataURL(fullUrl, { margin: 1, width: 256 });
  } catch {
    qrSrc = null;
  }
  const displayTotal = typeof src.payment.amountMXN === 'number'
    ? (src.payment.amountIsCents ? src.payment.amountMXN / 100 : src.payment.amountMXN)
    : d.total;
  // Desglose (Servicio, Comisión, IVA, Total)
  const amounts = (() => {
    const n = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const round2 = (v: number) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
    let servicio = typeof src.payment.subtotal === 'number' ? src.payment.subtotal : 0;
    let comision = 0;
    let iva = typeof src.payment.tax === 'number' ? src.payment.tax : 0;
    const items = Array.isArray(src.payment.items) ? src.payment.items : [];
    for (const it of items) {
      const label = String(it.description || '').toLowerCase();
      const val = typeof it.amount === 'number' ? it.amount : 0;
      if (label.includes('servicio')) servicio = val;
      else if (label.includes('comis')) comision = val; // comision/comisión
      else if (label === 'iva') iva = val;
    }
    let total = typeof src.payment.amountMXN === 'number'
      ? (src.payment.amountIsCents ? src.payment.amountMXN / 100 : src.payment.amountMXN)
      : (typeof src.payment.total === 'number' ? src.payment.total : 0);
    servicio = round2(servicio);
    comision = round2(comision);
    iva = round2(iva);
    const sum = round2(servicio + comision + iva);
    total = round2(total || sum);
    if (total !== sum) total = sum;
    return { servicio, comision, iva, total } as const;
  })();
  return (
    <section className="mx-auto my-10 max-w-3xl bg-white shadow-xl ring-1 ring-gray-200 rounded-2xl print:shadow-none print:ring-0 p-8 text-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.business?.logoUrl || '/handi-logo.svg'} alt={d.business?.name || 'Handi'} className="h-10 w-10 rounded" />
          <div>
            <div className="text-xl font-semibold tracking-tight">{d.business?.name || 'Handi'}</div>
            <div className="text-xs uppercase text-gray-500">Recibo de pago</div>
          </div>
        </div>
        <div className="text-right">
          {/* Logo top-right */}
          <img src="/handi-logo.svg" alt="Handi" className="h-6 w-auto ml-auto mb-1 hidden sm:block" />
          <div className="text-xs uppercase text-gray-500">Folio</div>
          <div className="text-sm font-medium">{d.id}</div>
          <div className="text-xs uppercase text-gray-500 mt-2">Fecha</div>
          <div className="text-sm">{formatDateMX(src.createdAtISO)}</div>
        </div>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      {/* Cliente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-xs uppercase text-gray-500">Cliente</div>
          <div className="text-sm font-medium">{d.customer_name}</div>
          {d.customer_email ? <div className="text-sm text-gray-700">{d.customer_email}</div> : null}
        </div>
        <div className="sm:text-right">
          <div className="text-xs uppercase text-gray-500">Servicio</div>
          <div className="text-sm font-medium">{d.request_title}</div>
          {src.service.requestId ? (
            <div className="text-sm text-blue-600 hover:underline">
              <Link href={`/requests/${encodeURIComponent(src.service.requestId)}`}>Ver solicitud</Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      {/* Pago */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
        <div className="sm:col-span-1">
          <div className="text-xs uppercase text-gray-500">Total</div>
          <div className="text-3xl font-bold tracking-tight">{formatMXN(displayTotal)}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-xs uppercase text-gray-500">Método</div>
          <div className="text-sm text-gray-900">{d.payment_method || '—'}</div>
          {src.payment.paymentIntentId ? (
            <div className="mt-2 text-xs text-gray-600">PaymentIntent: {src.payment.paymentIntentId}</div>
          ) : null}
          {src.payment.sessionId ? (
            <div className="mt-1 text-xs text-gray-600">Checkout Session: {src.payment.sessionId}</div>
          ) : null}
          {/* Desglose */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="text-sm text-gray-600">Servicio</div>
            <div className="text-sm text-right font-medium">{formatMXN(amounts.servicio)}</div>
            <div className="text-sm text-gray-600">Comisión</div>
            <div className="text-sm text-right font-medium">{formatMXN(amounts.comision)}</div>
            <div className="text-sm text-gray-600">IVA</div>
            <div className="text-sm text-right font-medium">{formatMXN(amounts.iva)}</div>
            <div className="col-span-2 h-px bg-gray-200 my-1" />
            <div className="text-sm font-semibold">Total</div>
            <div className="text-sm text-right font-semibold">{formatMXN(amounts.total)}</div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      {/* Comercio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-xs uppercase text-gray-500">Comercio</div>
          <div className="text-sm font-medium">{d.business?.name || 'Handi'}</div>
          {d.business?.website ? (
            <div className="text-sm text-blue-600 hover:underline">
              <a href={d.business.website} target="_blank" rel="noreferrer">{d.business.website}</a>
            </div>
          ) : null}
          {d.business?.supportEmail || d.business?.supportPhone ? (
            <div className="text-xs text-gray-600 mt-1">
              {d.business.supportEmail ? <a className="underline" href={`mailto:${d.business.supportEmail}`}>{d.business.supportEmail}</a> : null}
              {d.business.supportEmail && d.business.supportPhone ? ' · ' : ''}
              {d.business.supportPhone ? <a className="underline" href={`tel:${d.business.supportPhone}`}>{d.business.supportPhone}</a> : null}
            </div>
          ) : null}
        </div>
        <div className="sm:text-right">
          {d.business?.rfc ? (
            <div className="text-xs text-gray-600">RFC: {d.business.rfc}</div>
          ) : null}
          {d.business?.addressText ? (
            <div className="text-xs text-gray-600 mt-1">{d.business.addressText}</div>
          ) : null}
        </div>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      {/* QR + meta */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase text-gray-500">Verificación</div>
          <div className="text-sm text-gray-900">Escanéame para verificar</div>
          <div className="text-xs text-gray-600">{receiptUrl}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc || '/handi-logo.svg'} alt="QR" className="h-24 w-24 border rounded" />
      </div>
    </section>
  );
}
