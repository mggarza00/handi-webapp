import type { SupabaseClient } from "@supabase/supabase-js";

import { roundCurrency } from "@/lib/payments/fees";
import type { Database } from "@/types/supabase";

type RecordPaymentInput = {
  admin: SupabaseClient<Database>;
  requestId?: string | null;
  amount: number;
  fee: number;
  vat: number;
  currency?: string | null;
  status?: "pending" | "paid" | "refunded" | "failed" | "canceled" | "disputed";
  paymentIntentId?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RecordPaymentResult = {
  ok: boolean;
  inserted: boolean;
  paymentId?: string | null;
};

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const payment_intent_id = (input.paymentIntentId || "").trim();
  if (!payment_intent_id) return { ok: false, inserted: false };
  const amount = roundCurrency(Number(input.amount || 0));
  const fee = roundCurrency(Number(input.fee || 0));
  const vat = roundCurrency(Number(input.vat || 0));
  const currency = (input.currency || "MXN").toUpperCase();
  const status = input.status || "paid";
  const nowIso = input.createdAt || new Date().toISOString();
  const metadata = input.metadata || {};

  try {
    const { data: existing } = await input.admin
      .from("payments")
      .select("id")
      .eq("payment_intent_id", payment_intent_id)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await input.admin
        .from("payments")
        .update({
          request_id: input.requestId ?? null,
          amount,
          fee,
          vat,
          currency,
          status,
          metadata,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      if (error && /metadata/i.test(error.message || "")) {
        await input.admin
          .from("payments")
          .update({
            request_id: input.requestId ?? null,
            amount,
            fee,
            vat,
            currency,
            status,
            updated_at: nowIso,
          })
          .eq("id", existing.id);
      }
      return { ok: true, inserted: false, paymentId: existing.id as string };
    }

    let inserted: { id?: string | null } | null = null;
    const { data: insertData, error: insertError } = await input.admin
      .from("payments")
      .insert({
        request_id: input.requestId ?? null,
        amount,
        fee,
        vat,
        currency,
        status,
        payment_intent_id,
        created_at: nowIso,
        updated_at: nowIso,
        metadata,
      })
      .select("id")
      .maybeSingle();
    if (insertError && /metadata/i.test(insertError.message || "")) {
      const { data: insertNoMeta } = await input.admin
        .from("payments")
        .insert({
          request_id: input.requestId ?? null,
          amount,
          fee,
          vat,
          currency,
          status,
          payment_intent_id,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .maybeSingle();
      inserted = (insertNoMeta as { id?: string | null } | null) ?? null;
    } else {
      inserted = (insertData as { id?: string | null } | null) ?? null;
    }

    return {
      ok: true,
      inserted: true,
      paymentId: inserted?.id ?? null,
    };
  } catch {
    return { ok: false, inserted: false };
  }
}
