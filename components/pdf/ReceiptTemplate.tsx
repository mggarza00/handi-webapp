/* eslint-disable import/order */
import * as React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

import type { ServerReceipt } from '@/types/receipt';

const COLORS = {
  primary: '#0B3949',
  accent: '#3BB29E',
  text: '#475569',
  muted: '#E5E7EB',
  subtle: '#F4F6F8',
};

const styles = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 64, paddingHorizontal: 64, fontSize: 11, color: COLORS.text },
  header: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  logo: { width: 140, height: 56, objectFit: 'contain' },
  titleWrap: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: COLORS.primary, fontSize: 18, fontWeight: 700 },
  badge: { marginLeft: 8, backgroundColor: COLORS.accent, color: '#FFFFFF', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: 700 },
  sep: { borderBottomWidth: 1, borderBottomColor: COLORS.muted, marginVertical: 14 },
  meta: { display: 'flex', flexDirection: 'row', gap: 18 },
  col: { flex: 1 },
  label: { fontSize: 9, color: '#64748B', marginBottom: 2, textTransform: 'uppercase' },
  value: { fontSize: 11, color: COLORS.text },
  valueMono: { fontSize: 11, color: '#334155', fontFamily: 'Courier' },
  serviceCard: { backgroundColor: COLORS.subtle, borderRadius: 8, padding: 12, marginTop: 10, marginBottom: 14 },
  serviceTitle: { color: COLORS.primary, fontSize: 12, fontWeight: 700 },
  serviceDesc: { fontSize: 11, color: COLORS.text },
  breakdown: { borderWidth: 1, borderColor: COLORS.muted, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginTop: 6, marginBottom: 8 },
  breakdownRow: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  breakdownLabel: { fontSize: 11, color: '#64748B' },
  breakdownAmount: { fontSize: 12, fontWeight: 700, color: COLORS.text },
  totalBar: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.muted, marginTop: 6, marginBottom: 18 },
  totalLabel: { fontSize: 11, marginRight: 10, color: '#64748B' },
  totalValue: { fontSize: 28, fontWeight: 800, color: COLORS.primary },
  footer: { position: 'absolute', left: 64, right: 64, bottom: 32, fontSize: 9, color: '#64748B', textAlign: 'center' },
});

export type PdfReceiptData = {
  folio: string;
  createdAt: string;
  client: { name: string; email?: string | null };
  professional: { name: string };
  service: { title: string; description?: string | null };
  amounts: { servicio: number; comision: number; iva: number; total: number; currency: 'MXN' };
};

function formatCurrencyMXN(n: number): string {
  try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n); }
  catch { const v = Number.isFinite(n) ? n : 0; return `${v.toFixed(2)} MXN`; }
}

function formatDateTimeMX(iso: string): string {
  try { return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }
  catch { return iso; }
}

function computeTotal(sr: ServerReceipt): number {
  if (typeof sr.payment.amountMXN === 'number') return sr.payment.amountIsCents ? sr.payment.amountMXN / 100 : sr.payment.amountMXN;
  return sr.payment.total || 0;
}

export function toPdfReceiptData(sr: ServerReceipt): PdfReceiptData {
  const ext = sr as ServerReceipt & { meta?: { service_description?: string | null } };
  const total0 = computeTotal(sr);
  let servicio = typeof sr.payment.subtotal === 'number' ? sr.payment.subtotal : 0;
  let comision = 0;
  let iva = typeof sr.payment.tax === 'number' ? sr.payment.tax : 0;
  const items = Array.isArray(sr.payment.items) ? sr.payment.items : [];
  for (const it of items) {
    const label = String(it.description || '').toLowerCase();
    const val = typeof it.amount === 'number' ? it.amount : 0;
    if (label.includes('servicio')) servicio = val;
    else if (label.includes('comis')) comision = val;
    else if (label === 'iva') iva = val;
  }
  if (!servicio && (comision || iva)) servicio = Math.max(0, total0 - comision - iva);
  const round2 = (n: number) => Math.round(((Number.isFinite(n) ? Number(n) : 0) + Number.EPSILON) * 100) / 100;
  servicio = round2(servicio);
  comision = round2(comision);
  iva = round2(iva);
  let total = round2(total0);
  if (total !== round2(servicio + comision + iva)) total = round2(servicio + comision + iva);

  return {
    folio: sr.receiptId,
    createdAt: sr.createdAtISO,
    client: { name: sr.customer?.name || '', email: sr.customer?.email ?? null },
    professional: { name: sr.service?.professionalName || '' },
    service: { title: sr.service?.title || 'Servicio', description: ext.meta?.service_description ?? null },
    amounts: { servicio, comision, iva, total, currency: 'MXN' },
  };
}

export function ReceiptTemplate({ data, baseUrl }: { data: ServerReceipt; baseUrl?: string }) {
  const vm = toPdfReceiptData(data);
  const created = formatDateTimeMX(vm.createdAt);
  const candidate = (data as ServerReceipt)?.business?.logoUrl || (baseUrl ? `${baseUrl}/brand/handi-logo.png` : "/brand/handi-logo.png");
  const useImage = candidate && /\.(png|jpg|jpeg|gif)$/i.test(candidate);
  const fallbackLogo = baseUrl ? `${baseUrl}/images/LOGO_HANDI_DB.png` : '/images/LOGO_HANDI_DB.png';
  const logo = useImage ? candidate : fallbackLogo;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} wrap={false}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Recibo de pago</Text>
            <Text style={styles.badge}>PAGADO</Text>
          </View>
          {logo ? <Image src={logo} style={styles.logo} alt="Logo" /> : <Text style={styles.title}>Handi</Text>}
        </View>
        <View style={styles.sep} />

        {/* Meta */}
        <View style={styles.meta} wrap={false}>
          <View style={styles.col}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{vm.client.name}</Text>
            {vm.client.email ? <Text style={[styles.value, { fontSize: 10 }]}>{vm.client.email}</Text> : null}
            <View style={{ height: 8 }} />
            {vm.professional.name ? (
              <>
                <Text style={styles.label}>Profesional</Text>
                <Text style={styles.value}>{vm.professional.name}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Folio</Text>
            <Text style={styles.valueMono}>{vm.folio}</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.label}>Fecha</Text>
            <Text style={styles.value}>{created}</Text>
          </View>
        </View>

        {/* Servicio */}
        <View style={styles.serviceCard} wrap={false}>
          <Text style={styles.serviceTitle}>{vm.service.title}</Text>
          {vm.service.description ? <Text style={styles.serviceDesc} maxLines={12}>{vm.service.description}</Text> : null}
        </View>

        {/* Desglose */}
        <View style={styles.breakdown} wrap={false}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Servicio</Text>
            <Text style={styles.breakdownAmount}>{formatCurrencyMXN(vm.amounts.servicio)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Comisión</Text>
            <Text style={styles.breakdownAmount}>{formatCurrencyMXN(vm.amounts.comision)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>IVA</Text>
            <Text style={styles.breakdownAmount}>{formatCurrencyMXN(vm.amounts.iva)}</Text>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalBar} wrap={false}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrencyMXN(vm.amounts.total)}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Handi — Encuentra, conecta, resuelve.</Text>
        </View>
      </Page>
    </Document>
  );
}






