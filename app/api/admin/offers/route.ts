import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminOffer = {
  id: string;
  amount: number;
  currency: string;
  status: "sent" | "accepted" | "rejected" | "expired" | "canceled" | "paid";
  client: string;
  professional: string;
  created_at: string;
};

function fake(n: number): AdminOffer[] {
  const statuses: AdminOffer["status"][] = ["sent", "accepted", "rejected", "expired", "canceled", "paid"];
  return Array.from({ length: n }).map((_, i) => ({
    id: crypto.randomUUID(),
    amount: Math.floor(300 + Math.random() * 7000),
    currency: "MXN",
    status: statuses[i % statuses.length]!,
    client: `Cliente ${i + 1}`,
    professional: `Pro ${i + 1}`,
    created_at: new Date(Date.now() - i * 3600_000).toISOString(),
  }));
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) return NextResponse.json({ ok: true, items: fake(20) }, { headers: JSONH });

  const admin = getAdminSupabase();
  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "").toLowerCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let q = admin
    .from("offers")
    .select("id, amount, currency, status, client_id, professional_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const allowed: AdminOffer["status"][] = ["sent", "accepted", "rejected", "expired", "canceled", "paid"];
  if (status && (allowed as string[]).includes(status)) q = q.eq("status", status);
  if (from) q = q.gte("created_at", new Date(from).toISOString());
  if (to) q = q.lte("created_at", new Date(to).toISOString());

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  const clientIds = new Set<string>();
  const proIds = new Set<string>();
  for (const o of data || []) {
    if (o.client_id) clientIds.add(o.client_id as string);
    if (o.professional_id) proIds.add(o.professional_id as string);
  }
  const allIds = Array.from(new Set<string>([...clientIds, ...proIds]));
  let name = new Map<string, string>();
  if (allIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", allIds);
    name = new Map((profs || []).map((p) => [p.id as string, (p.full_name as string | null) || "—"]));
  }

  const items: AdminOffer[] = (data || []).map((o) => ({
    id: o.id as string,
    amount: o.amount as number,
    currency: (o.currency as string) || "MXN",
    status: o.status as AdminOffer["status"],
    client: name.get(o.client_id as string) || (o.client_id as string) || "—",
    professional: name.get(o.professional_id as string) || (o.professional_id as string) || "—",
    created_at: o.created_at as string,
  }));

  return NextResponse.json({ ok: true, items }, { headers: JSONH });
}

