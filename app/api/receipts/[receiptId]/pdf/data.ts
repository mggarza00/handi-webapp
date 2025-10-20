/* eslint-disable import/order */
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const Row = z.object({
  receipt_id: z.string(),
  folio: z.string(),
  created_at: z.string(),
  service_title: z.string().nullable(),
  service_description: z.string().nullable(),
  client_name: z.string().nullable(),
  client_email: z.string().nullable(),
  professional_name: z.string().nullable(),
  servicio_mxn: z.number().nullable(),
  comision_mxn: z.number().nullable(),
  iva_mxn: z.number().nullable(),
  total_mxn: z.number().nullable(),
  // cents-based fields (preferred if available)
  service_amount: z.number().nullable().optional(),
  commission_amount: z.number().nullable().optional(),
  iva_amount: z.number().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

export type ReceiptPdfRow = z.infer<typeof Row>;

export async function getReceiptData(receiptId: string): Promise<ReceiptPdfRow | null> {
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from('v_receipt_pdf')
    .select('*')
    .eq('receipt_id', receiptId)
    .single();
  if (error) throw error;
  const row = Row.parse(data);
  const n = (x: number | null | undefined) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  // Try cents first
  let sC = n(row.service_amount);
  let cC = n(row.commission_amount);
  let iC = n(row.iva_amount);
  let tC = n(row.total_amount);
  if (sC === 0 && cC === 0 && iC === 0 && tC === 0) {
    // fallback to MXN floats
    sC = Math.round(n(row.servicio_mxn) * 100);
    cC = Math.round(n(row.comision_mxn) * 100);
    iC = Math.round(n(row.iva_mxn) * 100);
    tC = Math.round(n(row.total_mxn) * 100);
  }
  if (tC === 0) tC = sC + cC + iC;
  const servicio = round2(sC / 100);
  const comision = round2(cC / 100);
  const iva = round2(iC / 100);
  let total = round2(tC / 100);
  const sum = round2(servicio + comision + iva);
  if (total !== sum) total = sum;
  return {
    ...row,
    servicio_mxn: servicio,
    comision_mxn: comision,
    iva_mxn: iva,
    total_mxn: total,
  };
}
