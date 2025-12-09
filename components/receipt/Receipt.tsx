/* eslint-disable import/order */
import * as React from 'react';
import { formatCurrencyMXN, formatDateCDMX } from '@/lib/mx-format';

export type ReceiptItem = {
  description: string;
  quantity?: number;
  unit_price?: number; // MXN
  amount: number; // MXN
};

export type ReceiptData = {
  id: string; // receipt id / folio
  created_at: string; // ISO
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  provider_name?: string | null; // profesional
  request_title?: string | null;
  service_date?: string | null; // ISO (día del servicio)
  payment_method?: string | null; // p.ej. Tarjeta (**** 4242)
  items: ReceiptItem[];
  subtotal: number;
  tax?: number; // IVA/0
  total: number;
  notes?: string | null;
  business?: {
    name: string;
    logoUrl?: string | null;
    rfc?: string | null;
    website?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    address?: { line1: string; line2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null } | null;
    addressText?: string | null;
  } | null;
  meta?: Record<string, string> | null;
};

export default function Receipt({ data }: { data: ReceiptData }) {
  const {
    id,
    created_at,
    customer_name,
    customer_email,
    customer_phone,
    provider_name,
    request_title,
    service_date,
    payment_method,
    items,
    subtotal,
    tax,
    total,
    notes,
    business,
    meta,
  } = data;

  return (
    <div className="mx-auto w-full max-w-[800px] bg-white text-slate-900 rounded-xl border shadow-sm print:shadow-none print:border-0 print:rounded-none">
      {/* Header */}
      <div className="p-6 border-b flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {business?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt={business.name || 'Logo'} className="h-10 w-10 rounded" />
          ) : null}
          <div>
            <div className="text-2xl font-semibold tracking-tight">{business?.name || 'Handi'}</div>
            <div className="text-xs text-slate-500">Recibo de pago</div>
            {business?.website ? (
              <div className="text-[11px] text-slate-500">{business.website}</div>
            ) : null}
          </div>
        </div>
        <div className="text-right text-sm">
          <div><span className="text-slate-500">Folio:</span> <span className="font-medium">{id}</span></div>
          <div><span className="text-slate-500">Fecha:</span> {formatDateCDMX(created_at)}</div>
        </div>
      </div>

      {/* Parties */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-[13px] text-slate-500 mb-1">Cliente</div>
          <div className="font-medium">{customer_name}</div>
          {customer_email ? <div className="text-sm text-slate-600">{customer_email}</div> : null}
          {customer_phone ? <div className="text-sm text-slate-600">{customer_phone}</div> : null}
        </div>
        <div className="sm:text-right">
          <div className="text-[13px] text-slate-500 mb-1">Profesional</div>
          <div className="font-medium">{provider_name || '—'}</div>
          {request_title ? <div className="text-sm text-slate-600">Servicio: {request_title}</div> : null}
          {service_date ? <div className="text-sm text-slate-600">Fecha de servicio: {formatDateCDMX(service_date)}</div> : null}
          {payment_method ? <div className="text-sm text-slate-600">Pago: {payment_method}</div> : null}
          {business?.rfc ? <div className="text-xs text-slate-500 mt-2">RFC: {business.rfc}</div> : null}
        </div>
      </div>

      {/* Items */}
      <div className="px-6">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-medium px-4 py-2">Descripción</th>
                <th className="text-right font-medium px-4 py-2">Cantidad</th>
                <th className="text-right font-medium px-4 py-2">Precio unit.</th>
                <th className="text-right font-medium px-4 py-2">Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 align-top">
                    <div className="font-medium text-slate-800">{it.description}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">{typeof it.quantity === 'number' ? it.quantity : '—'}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{typeof it.unit_price === 'number' ? formatCurrencyMXN(it.unit_price) : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrencyMXN(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="p-6 flex items-end justify-end">
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">Subtotal</div>
            <div className="font-medium">{formatCurrencyMXN(subtotal)}</div>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <div className="text-slate-600">Impuestos</div>
            <div className="font-medium">{formatCurrencyMXN(tax ?? 0)}</div>
          </div>
          <div className="flex items-center justify-between text-base mt-3 pt-3 border-t">
            <div className="font-semibold">Total</div>
            <div className="font-semibold">{formatCurrencyMXN(total)}</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {notes ? (
        <div className="px-6 pb-6">
          <div className="text-[13px] text-slate-500 mb-1">Notas</div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</div>
        </div>
      ) : null}

      {meta && Object.keys(meta).length ? (
        <div className="px-6 pb-6">
          <div className="text-[13px] text-slate-500 mb-1">Información adicional</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b py-1">
                <div className="text-slate-600">{k}</div>
                <div className="font-medium text-slate-800">{v}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 text-[12px] text-slate-500 rounded-b-xl print:rounded-none">
        {business?.supportEmail || business?.supportPhone || business?.addressText ? (
          <div>
            {business?.addressText ? <div className="mb-1">{business.addressText}</div> : null}
            {business?.supportEmail || business?.supportPhone ? (
              <div>
                Soporte: {business?.supportEmail ? <a href={`mailto:${business.supportEmail}`} className="underline">{business.supportEmail}</a> : null}
                {business?.supportEmail && business?.supportPhone ? ' · ' : ''}
                {business?.supportPhone ? <a href={`tel:${business.supportPhone}`} className="underline">{business.supportPhone}</a> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div>Recibo generado por Handi. Conserva este comprobante para tu referencia.</div>
        )}
      </div>
    </div>
  );
}
