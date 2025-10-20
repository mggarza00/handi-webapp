import { createClient } from '@supabase/supabase-js';

import type { ServerReceipt } from '@/types/receipt';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { generateSimpleFolio } from '@/lib/folio';

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const round2 = (n: number) => Math.round(((Number.isFinite(n) ? Number(n) : 0) + Number.EPSILON) * 100) / 100;

type _ReceiptViewRow = {
  receipt_id: string;
  folio: string;
  created_at: string;
  request_id?: string | null;
  service_title: string | null;
  service_description: string | null;
  client_name: string | null;
  client_email: string | null;
  professional_name: string | null;
  servicio_mxn: number | null;
  comision_mxn: number | null;
  iva_mxn: number | null;
  total_mxn: number | null;
};

export async function getReceipt(receiptId: string): Promise<ServerReceipt | null> {
  const admin = supaAdmin();
  if (!admin) return null;

  const { data: row } = await admin
    .from('v_receipt_pdf')
    .select('*')
    .eq('receipt_id', receiptId)
    .maybeSingle();

  if (!row) return null;

  const nn = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  let sC = nn((row as any).service_amount);
  let cC = nn((row as any).commission_amount);
  let iC = nn((row as any).iva_amount);
  let tC = nn((row as any).total_amount);
  if (sC === 0 && cC === 0 && iC === 0 && tC === 0) {
    sC = Math.round(nn((row as any).servicio_mxn) * 100);
    cC = Math.round(nn((row as any).comision_mxn) * 100);
    iC = Math.round(nn((row as any).iva_mxn) * 100);
    tC = Math.round(nn((row as any).total_mxn) * 100);
  }
  if (tC === 0) tC = sC + cC + iC;
  const servicio = round2(sC / 100);
  const comision = round2(cC / 100);
  const iva = round2(iC / 100);
  let total = round2(tC / 100);
  const sum = round2(servicio + comision + iva);
  if (total !== sum) total = sum;

  const createdISO = (row as any).created_at ?? new Date().toISOString();
  const rawFolio = (row as any).folio as string | null;
  const displayFolio = rawFolio && rawFolio.trim()
    ? rawFolio.trim()
    : generateSimpleFolio(String((row as any).receipt_id || receiptId), new Date(createdISO));

  // Best-effort: persist the generated folio if receipts table exists and folio is null
  try {
    if ((!rawFolio || !rawFolio.trim()) && (row as any).receipt_id) {
      const admin = supaAdmin();
      if (admin) {
        await admin
          .from('receipts')
          .update({ folio: displayFolio })
          .eq('id', (row as any).receipt_id)
          .is('folio', null);
      }
    }
  } catch {
    // ignore persistence errors (table may not exist)
  }
  const data: ServerReceipt = {
    receiptId: displayFolio,
    createdAtISO: row.created_at ?? new Date().toISOString(),
    customer: { name: row.client_name || '', email: row.client_email || '' },
    service: {
      title: row.service_title || 'Servicio',
      requestId: row.request_id || '',
      professionalName: row.professional_name || '',
      dateISO: null,
    },
    payment: {
      method: 'card', brand: null, last4: null,
      amountMXN: total, amountIsCents: false,
      items: [
        { description: 'Servicio', amount: servicio },
        { description: 'ComisiÃ³n', amount: comision },
        { description: 'IVA', amount: iva },
      ],
      subtotal: servicio,
      tax: iva,
      total,
      currency: 'MXN',
      notes: null, paymentIntentId: null, sessionId: null,
    },
    business: { name: 'Handi', website: null, legalName: null, rfc: null, taxInfo: null, logoUrl: null, address: null, addressText: null, supportEmail: null, supportPhone: null },
    meta: row.service_description ? { service_description: row.service_description } : null,
  };

  return data;
}

// Canonical view reader for PDF/UI: always reads from v_receipt_pdf (cents-based when available)
export type ReceiptViewRow = {
  receipt_id: string;
  created_at: string;
  folio: string | null;
  currency: string | null;
  service_amount?: number | null;
  commission_amount?: number | null;
  iva_amount?: number | null;
  total_amount?: number | null;
  client_name: string | null;
  client_email: string | null;
  professional_name: string | null;
  service_title: string | null;
  service_description: string | null;
  request_id?: string | null;
};

export async function getReceiptForPdf(supabase: SupabaseClient<Database>, id: string): Promise<ReceiptViewRow | null> {
  // Try primary key match first (receipts.id)
  let { data } = await supabase
    .from('v_receipt_pdf')
    .select('*')
    .eq('receipt_id', id)
    .maybeSingle<ReceiptViewRow>();

  // If not found, try by folio (human-readable RCPT-YYYY-XXXXX)
  if (!data) {
    const byFolio = await supabase
      .from('v_receipt_pdf')
      .select('*')
      .eq('folio', id)
      .maybeSingle<ReceiptViewRow>();
    if (byFolio.data) data = byFolio.data as any;
  }

  // If still not found and looks like our fallback token (RCPT-<cs_...> or RCPT-<pi_...>) or raw cs_/pi_
  if (!data) {
    const token = id?.startsWith('RCPT-') ? id.slice(5) : id;
    const isSession = typeof token === 'string' && token.startsWith('cs_');
    const isPI = typeof token === 'string' && token.startsWith('pi_');
    if (isSession || isPI) {
      // Look up the real receipt id from receipts table
      try {
        const { data: rec } = await (supabase as any)
          .from('receipts')
          .select('id')
          .eq(isSession ? 'checkout_session_id' : 'payment_intent_id', token)
          .maybeSingle();
        const realId = (rec as any)?.id as string | undefined;
        if (realId) {
          const byReal = await supabase
            .from('v_receipt_pdf')
            .select('*')
            .eq('receipt_id', realId)
            .maybeSingle<ReceiptViewRow>();
          if (byReal.data) data = byReal.data as any;
        }
      } catch {
        // ignore mapping errors
      }
    }
  }
  // Last-resort fallback: derive from the chat message + conversation if the webhook
  // has not persisted the receipts row yet. This enables RCPT-cs_*/RCPT-pi_* links
  // to work immediately after checkout success.
  if (!data) {
    try {
      // Find the conversation via the system message carrying this receipt_id
      const { data: msg } = await (supabase as any)
        .from('messages')
        .select('conversation_id, created_at')
        .eq('message_type', 'system')
        .contains('payload', { receipt_id: id })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const convId = (msg as any)?.conversation_id as string | undefined;
      const createdAt = (msg as any)?.created_at as string | undefined;
      if (convId) {
        const [{ data: conv }, { data: req }, { data: client }, { data: pro }] = await Promise.all([
          (supabase as any).from('conversations').select('id, request_id, customer_id, pro_id').eq('id', convId).maybeSingle(),
          (supabase as any).from('requests').select('id, title, description').eq('id', (msg as any)?.request_id || null).maybeSingle(),
          (supabase as any).from('profiles').select('id, full_name, email').eq('id', (msg as any)?.customer_id || null).maybeSingle(),
          (supabase as any).from('profiles').select('id, full_name').eq('id', (msg as any)?.pro_id || null).maybeSingle(),
        ]);
        // If request/profile data via msg is not available, fetch via conversation
        let requestId = (conv as any)?.request_id as string | null;
        let customerId = (conv as any)?.customer_id as string | null;
        let proId = (conv as any)?.pro_id as string | null;
        const [{ data: req2 }, { data: client2 }, { data: pro2 }] = await Promise.all([
          requestId ? (supabase as any).from('requests').select('id, title, description').eq('id', requestId).maybeSingle() : Promise.resolve({ data: null }),
          customerId ? (supabase as any).from('profiles').select('id, full_name, email').eq('id', customerId).maybeSingle() : Promise.resolve({ data: null }),
          proId ? (supabase as any).from('profiles').select('id, full_name').eq('id', proId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        const reqRow = (req as any) || (req2 as any) || {};
        const clientRow = (client as any) || (client2 as any) || {};
        const proRow = (pro as any) || (pro2 as any) || {};
        // Heuristic for amount: prefer paid offer, else accepted, else latest
        let amount = 0;
        let currency = 'MXN';
        try {
          const paid = await (supabase as any)
            .from('offers')
            .select('amount, currency, created_at')
            .eq('conversation_id', convId)
            .eq('status', 'paid')
            .order('created_at', { ascending: false })
            .limit(1);
          const accepted = await (supabase as any)
            .from('offers')
            .select('amount, currency, created_at')
            .eq('conversation_id', convId)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false })
            .limit(1);
          const latest = await (supabase as any)
            .from('offers')
            .select('amount, currency, created_at')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: false })
            .limit(1);
          const pick = (paid?.data?.[0] as any) || (accepted?.data?.[0] as any) || (latest?.data?.[0] as any) || null;
          if (pick) {
            const a = Number((pick as any).amount ?? 0);
            if (Number.isFinite(a)) amount = a;
            const cur = (pick as any).currency;
            if (typeof cur === 'string' && cur.trim()) currency = cur.toUpperCase();
          }
        } catch { /* ignore */ }
        const baseCents = Math.round(((Number.isFinite(amount) ? amount : 0) + Number.EPSILON) * 100);
        const feeCents = baseCents > 0 ? Math.min(150000, Math.max(5000, Math.round(baseCents * 0.05))) : 0; // 50–1500 MXN
        const ivaCents = baseCents > 0 ? Math.round((baseCents + feeCents) * 0.16) : 0;
        const totalCents = baseCents + feeCents + ivaCents;
        data = {
          receipt_id: id,
          created_at: createdAt || new Date().toISOString(),
          folio: null,
          currency,
          service_amount: baseCents,
          commission_amount: feeCents,
          iva_amount: ivaCents,
          total_amount: totalCents,
          client_name: clientRow?.full_name || null,
          client_email: clientRow?.email || null,
          professional_name: proRow?.full_name || null,
          service_title: reqRow?.title || 'Servicio',
          service_description: reqRow?.description || null,
          request_id: requestId || null,
        } as ReceiptViewRow;
      }
    } catch {
      // swallow errors and keep data as null
    }
  }

  if (!data) return null;

  const createdISO = data.created_at ?? new Date().toISOString();
  const folio = (data.folio && data.folio.trim())
    ? data.folio.trim()
    : generateSimpleFolio(String(data.receipt_id || id), new Date(createdISO));

  // Persist folio if missing (idempotent), best‑effort
  try {
    if (!data.folio || !data.folio.trim()) {
      await (supabase as any)
        .from('receipts')
        .update({ folio })
        .eq('id', data.receipt_id)
        .is('folio', null);
      (data as any).folio = folio;
    }
  } catch {
    // ignore if table doesn't exist or no permission
  }

  // Normalize cents and currency
  const nn = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  let service_amount = nn((data as any).service_amount);
  let commission_amount = nn((data as any).commission_amount);
  let iva_amount = nn((data as any).iva_amount);
  let total_amount = nn((data as any).total_amount);
  if (total_amount === 0) total_amount = service_amount + commission_amount + iva_amount;

  // If commission and IVA are both zero but we have context, derive them from business rule (5% fee, IVA 16%).
  if ((commission_amount === 0 && iva_amount === 0) && total_amount > 0) {
    try {
      // Try to derive base amount from latest offer of the related conversation
      const reqId = (data as any).request_id as string | null | undefined;
      let convId: string | null = null;
      if (reqId) {
        const { data: convs } = await (supabase as any)
          .from('conversations')
          .select('id, created_at')
          .eq('request_id', reqId)
          .order('created_at', { ascending: false })
          .limit(1);
        convId = Array.isArray(convs) && convs.length ? (convs[0] as any).id as string : null;
      }
      if (convId) {
        const { data: offersPaid } = await (supabase as any)
          .from('offers')
          .select('amount, currency, created_at')
          .eq('conversation_id', convId)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1);
        const { data: offersAcc } = await (supabase as any)
          .from('offers')
          .select('amount, currency, created_at')
          .eq('conversation_id', convId)
          .eq('status', 'accepted')
          .order('created_at', { ascending: false })
          .limit(1);
        const { data: offersAny } = await (supabase as any)
          .from('offers')
          .select('amount, currency, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1);
        const pick = (offersPaid?.[0] as any) || (offersAcc?.[0] as any) || (offersAny?.[0] as any) || null;
        const base = pick ? Number((pick as any).amount ?? NaN) : NaN;
        const baseC = Number.isFinite(base) ? Math.round(base * 100) : 0;
        if (baseC > 0) {
          service_amount = baseC;
          const feeC = Math.min(150000, Math.max(5000, Math.round(baseC * 0.05)));
          const ivaC = Math.round((baseC + feeC) * 0.16);
          commission_amount = feeC;
          iva_amount = ivaC;
          total_amount = service_amount + commission_amount + iva_amount;
        }
      }
    } catch { /* ignore */ }
  }

  return {
    receipt_id: data.receipt_id,
    created_at: createdISO,
    folio,
    currency: data.currency || 'MXN',
    service_amount,
    commission_amount,
    iva_amount,
    total_amount,
    client_name: data.client_name,
    client_email: data.client_email,
    professional_name: data.professional_name,
    service_title: data.service_title,
    service_description: data.service_description,
    request_id: (data as any).request_id ?? null,
  };
}


