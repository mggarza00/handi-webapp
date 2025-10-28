import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const admin = getAdminSupabase();
  let q = admin
    .from("payments")
    .select("id, request_id, amount, fee, vat, currency, status, payment_intent_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (from) q = q.gte("created_at", new Date(from).toISOString());
  if (to) q = q.lte("created_at", new Date(to).toISOString());
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, items: data }, { headers: JSONH });
}

