import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPayment = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "failed" | "canceled" | "disputed";
  customer: string;
  created_at: string;
};

function fake(n: number): AdminPayment[] {
  const arr: AdminPayment[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: `pi_${Math.random().toString(36).slice(2, 10)}`,
      amount: Math.floor(200 + Math.random() * 5000),
      currency: "MXN",
      status: ["paid", "paid", "paid", "refunded", "failed"][i % 5] as AdminPayment["status"],
      customer: `Cliente ${i + 1}`,
      created_at: new Date(Date.now() - i * 7200_000).toISOString(),
    });
  }
  return arr;
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) return NextResponse.json({ ok: true, items: fake(15) }, { headers: JSONH });

  const admin = getAdminSupabase();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = (url.searchParams.get("status") || "").toLowerCase();

  // Source of truth: public.payments
  let q = admin
    .from("payments")
    .select("id, request_id, amount, fee, vat, currency, status, payment_intent_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (from) q = q.gte("created_at", new Date(from).toISOString());
  if (to) q = q.lte("created_at", new Date(to).toISOString());
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  // Resolve customer from requests.created_by
  const reqIds = Array.from(new Set((data || []).map((p) => p.request_id as string).filter(Boolean)));
  let reqToCustomer = new Map<string, string>();
  if (reqIds.length > 0) {
    const { data: reqs } = await admin.from("requests").select("id, created_by").in("id", reqIds);
    const customerIds = Array.from(new Set((reqs || []).map((r) => r.created_by as string).filter(Boolean)));
    let names = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", customerIds);
      names = new Map((profs || []).map((p) => [p.id as string, (p.full_name as string | null) || "Cliente"]));
    }
    reqToCustomer = new Map((reqs || []).map((r) => [r.id as string, names.get(r.created_by as string) || (r.created_by as string) || "—"]));
  }

  const items: AdminPayment[] = (data || []).map((p) => ({
    id: (p.payment_intent_id as string | null) || (p.id as string),
    amount: Number(p.amount as number),
    currency: (p.currency as string) || "MXN",
    status: (p.status as AdminPayment["status"]) || "paid",
    customer: p.request_id ? (reqToCustomer.get(p.request_id as string) || "—") : "—",
    created_at: p.created_at as string,
  }));
  return NextResponse.json({ ok: true, items }, { headers: JSONH });
}
