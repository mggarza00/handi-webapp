import type { ServerReceipt } from '@/types/receipt';
import type { ReceiptData } from '@/components/receipt/Receipt';

export function toReceiptData(src: ServerReceipt): ReceiptData {
  const pm = (() => {
    const parts: string[] = [];
    const brand = src.payment.brand || undefined;
    if (src.payment.method) parts.push(String(src.payment.method));
    if (brand) parts.push(String(brand).toUpperCase());
    const last4 = src.payment.last4 || undefined;
    if (last4) parts.push(`(**** ${last4})`);
    return parts.join(' ');
  })();

  // Calcular totales a partir de amountMXN si corresponde
  const calc = (() => {
    let subtotal = src.payment.subtotal;
    let tax = src.payment.tax ?? 0;
    let total = src.payment.total;
    const items = (src.payment.items || []).slice();
    if ((!items || items.length === 0) && typeof src.payment.amountMXN === 'number') {
      const isCents = Boolean(src.payment.amountIsCents);
      const val = isCents ? src.payment.amountMXN / 100 : src.payment.amountMXN;
      subtotal = val;
      total = val;
      tax = src.payment.tax ?? 0;
      // Generar un item genérico si falta
      items.push({ description: src.service.title || 'Servicio', amount: val });
    }
    return { subtotal, tax, total, items };
  })();
  return {
    id: src.receiptId,
    created_at: src.createdAtISO,
    customer_name: src.customer.name,
    customer_email: src.customer.email ?? null,
    customer_phone: src.customer.phone ?? null,
    provider_name: src.service.professionalName ?? null,
    request_title: src.service.title,
    service_date: src.service.dateISO ?? null,
    payment_method: pm,
    items: calc.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      amount: it.amount,
    })),
    subtotal: calc.subtotal,
    tax: calc.tax,
    total: calc.total,
    notes: buildNotes(src),
    business: buildBusiness(src),
    meta: src.meta ?? null,
  };
}

function buildNotes(src: ServerReceipt): string | null {
  const parts: string[] = [];
  if (src.payment.notes) parts.push(src.payment.notes);
  if (src.payment.paymentIntentId) parts.push(`Ref: ${src.payment.paymentIntentId}`);
  if (src.payment.sessionId) parts.push(`Checkout: ${src.payment.sessionId}`);
  return parts.length ? parts.join('\n') : null;
}

function buildBusiness(src: ServerReceipt): ReceiptData['business'] {
  const b = src.business || null;
  if (!b) return null;
  const rfc = b.taxInfo || b.rfc || null;
  // Prefer addressText if provided; otherwise format structured address line1[, line2], city, state, CP
  let addressText = b.addressText || null;
  if (!addressText && b.address) {
    const segs = [b.address.line1, b.address.line2, b.address.city, b.address.state, b.address.postalCode ? `CP ${b.address.postalCode}` : null]
      .filter(Boolean) as string[];
    addressText = segs.join(', ');
  }
  return {
    name: b.name,
    logoUrl: b.logoUrl ?? null,
    rfc,
    supportEmail: b.supportEmail ?? null,
    supportPhone: b.supportPhone ?? null,
    website: b.website ?? null,
    addressText,
    address: b.address ?? null,
  } as ReceiptData['business'];
}
