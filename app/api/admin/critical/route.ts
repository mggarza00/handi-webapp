import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KycItem = { id: string; user_id: string; status: string; updated_at: string | null };
type DisputeItem = { id: string; amount: number; currency: string; created_at: string };

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

  const kycPending = (kyc || []) as unknown as KycItem[];
  const disputesNew = (disputes || [])
    .map((p) => ({ id: (p as any).id as string, amount: Number((p as any).amount || 0), currency: String((p as any).currency || 'MXN'), created_at: (p as any).created_at as string })) as DisputeItem[];

  return NextResponse.json({ ok: true, kycPending, disputesNew }, { headers: JSONH });
}

