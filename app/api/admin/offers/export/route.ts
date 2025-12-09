import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  amount: number;
  currency: string;
  status: "sent" | "accepted" | "rejected" | "expired" | "canceled" | "paid";
  client: string;
  professional: string;
  created_at: string;
};

function toCSV(rows: Row[]): string {
  const escape = (v: unknown) => {
    const s = (v ?? "").toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["id", "amount", "currency", "status", "client", "professional", "created_at"].join(",");
  const lines = rows.map((r) =>
    [r.id, r.amount, r.currency, r.status, r.client, r.professional, r.created_at].map(escape).join(","),
  );
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "").toLowerCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    const now = new Date();
    const mock: Row[] = Array.from({ length: 20 }).map((_, i) => ({
      id: crypto.randomUUID(),
      amount: Math.floor(300 + Math.random() * 7000),
      currency: "MXN",
      status: ["sent", "accepted", "rejected", "expired", "canceled", "paid"][i % 6] as Row["status"],
      client: `Cliente ${i + 1}`,
      professional: `Pro ${i + 1}`,
      created_at: new Date(now.getTime() - i * 3600_000).toISOString(),
    }));
    const csv = toCSV(mock);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=offers.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = getAdminSupabase();
  let q = admin
    .from("offers")
    .select("id, amount, currency, status, client_id, professional_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  const allowed: Row["status"][] = ["sent", "accepted", "rejected", "expired", "canceled", "paid"];
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
  const idList = Array.from(new Set<string>([...clientIds, ...proIds]));
  let name = new Map<string, string>();
  if (idList.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", idList);
    name = new Map((profs || []).map((p) => [p.id as string, (p.full_name as string | null) || "—"]));
  }

  const rows: Row[] = (data || []).map((o) => ({
    id: o.id as string,
    amount: o.amount as number,
    currency: (o.currency as string) || "MXN",
    status: o.status as Row["status"],
    client: name.get(o.client_id as string) || (o.client_id as string) || "—",
    professional: name.get(o.professional_id as string) || (o.professional_id as string) || "—",
    created_at: o.created_at as string,
  }));

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=offers.csv",
      "Cache-Control": "no-store",
    },
  });
}

