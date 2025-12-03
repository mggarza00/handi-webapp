import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KycItem = { id: string; user_id: string; status: string; updated_at: string | null };
type DisputeItem = { id: string; amount: number; currency: string; created_at: string };
type ProApplicationRow = { id: string | null; user_id: string | null; status: string | null; updated_at: string | null };
type PaymentRow = { id: string | null; amount: number | null; currency: string | null; created_at: string | null };

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    const now = new Date();
    const kycPending: KycItem[] = Array.from({ length: 5 }).map((_, i) => ({
      id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      status: 'pending',
      updated_at: new Date(now.getTime() - i * 3600_000).toISOString(),
    }));
    const disputesNew: DisputeItem[] = Array.from({ length: 3 }).map((_, i) => ({
      id: `pi_${Math.random().toString(36).slice(2, 10)}`,
      amount: Math.floor(300 + Math.random() * 4000),
      currency: 'MXN',
      created_at: new Date(now.getTime() - i * 7200_000).toISOString(),
    }));
    return NextResponse.json({ ok: true, kycPending, disputesNew }, { headers: JSONH });
  }

  const admin = getAdminSupabase();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: kyc } = await admin
    .from('pro_applications')
    .select('id, user_id, status, updated_at')
    .eq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(20);

  const { data: disputes } = await admin
    .from('payments')
    .select('id, amount, currency, created_at, status')
    .eq('status', 'disputed')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  const kycPending: KycItem[] = (kyc || [])
    .map((row) => ({
      id: String(row?.id ?? ''),
      user_id: String(row?.user_id ?? ''),
      status: String(row?.status ?? 'pending'),
      updated_at: (row as ProApplicationRow)?.updated_at ?? null,
    }))
    .filter((entry) => entry.id.length > 0 && entry.user_id.length > 0);

  const disputesNew: DisputeItem[] = (disputes || [])
    .map((p) => ({
      id: String((p as PaymentRow)?.id ?? ''),
      amount: Number((p as PaymentRow)?.amount ?? 0),
      currency: String((p as PaymentRow)?.currency ?? 'MXN'),
      created_at: String((p as PaymentRow)?.created_at ?? ''),
    }))
    .filter((entry) => entry.id.length > 0 && entry.created_at.length > 0);

  return NextResponse.json({ ok: true, kycPending, disputesNew }, { headers: JSONH });
}
