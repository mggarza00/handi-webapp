import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPayout = {
  id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "canceled";
  created_at: string;
  paid_at: string | null;
  receipt_url: string | null;
};

function fake(n: number): AdminPayout[] {
  const arr: AdminPayout[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: `po_${Math.random().toString(36).slice(2, 10)}`,
      professional_id: `pro_${i + 1}`,
      professional_name: `Profesional ${i + 1}`,
      amount: Math.floor(500 + Math.random() * 5000),
      currency: "MXN",
      status: i % 4 === 0 ? "paid" : "pending",
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
      paid_at:
        i % 4 === 0 ? new Date(Date.now() - i * 1800_000).toISOString() : null,
      receipt_url: i % 4 === 0 ? `/api/admin/payouts/po_${i}/receipt` : null,
    });
  }
  return arr;
}

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey)
    return NextResponse.json({ ok: true, items: fake(20) }, { headers: JSONH });

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("payouts")
    .select(
      "id, professional_id, amount, currency, status, created_at, paid_at, receipt_url",
    )
    .order("created_at", { ascending: true });
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: JSONH },
    );

  const proIds = Array.from(
    new Set(
      (data || []).map((row) => row.professional_id as string).filter(Boolean),
    ),
  );
  let nameMap = new Map<string, string>();
  if (proIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", proIds);
    nameMap = new Map(
      (profs || []).map((row) => [
        row.id as string,
        (row.full_name as string | null) || row.id,
      ]),
    );
  }

  const items: AdminPayout[] = (data || []).map((row) => ({
    id: row.id as string,
    professional_id: row.professional_id as string,
    professional_name:
      nameMap.get(row.professional_id as string) || row.professional_id,
    amount: Number(row.amount ?? 0),
    currency: (row.currency as string) || "MXN",
    status: (row.status as AdminPayout["status"]) || "pending",
    created_at: row.created_at as string,
    paid_at: (row.paid_at as string | null) || null,
    receipt_url: (row.receipt_url as string | null) || null,
  }));

  return NextResponse.json({ ok: true, items }, { headers: JSONH });
}
