import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  customer: string;
  city: string | null;
  category: string | null;
  budget: number | null;
  status: string | null;
  created_at: string;
};

function toCSV(rows: Row[]): string {
  const esc = (v: unknown) => {
    const s = (v ?? "").toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["id", "customer", "city", "category", "budget", "status", "created_at"].join(",");
  const lines = rows.map((r) => [r.id, r.customer, r.city || "", r.category || "", r.budget ?? "", r.status || "", r.created_at].map(esc).join(","));
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    // Mock
    const mock: Row[] = Array.from({ length: 20 }).map((_, i) => ({
      id: crypto.randomUUID(),
      customer: `Cliente ${i + 1}`,
      city: ["CDMX", "Monterrey", "Guadalajara"][i % 3]!,
      category: ["Limpieza", "Plomería", "Electricidad"][i % 3]!,
      budget: Math.floor(500 + Math.random() * 5000),
      status: ["active", "in_process", "completed", "cancelled"][i % 4]!,
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
    }));
    const csv = toCSV(mock);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=requests.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = getAdminSupabase();
  let qReq = admin
    .from("requests")
    .select("id, created_at, city, category, budget, status, created_by")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (status) qReq = qReq.eq("status", status);
  if (city) qReq = qReq.eq("city", city);
  if (from) qReq = qReq.gte("created_at", new Date(from).toISOString());
  if (to) qReq = qReq.lte("created_at", new Date(to).toISOString());

  const { data, error } = await qReq;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  const userIds = Array.from(new Set((data || []).map((r) => r.created_by))).filter(Boolean) as string[];
  let names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", userIds);
    names = new Map((profs || []).map((p) => [p.id as string, (p.full_name as string | null) || "—"]));
  }

  let rows: Row[] = (data || []).map((r) => ({
    id: r.id as string,
    customer: names.get(r.created_by as string) || (r.created_by as string) || "—",
    city: r.city as string | null,
    category: r.category as string | null,
    budget: (r.budget as number | null) ?? null,
    status: (r.status as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  if (q) {
    const qq = q.toLowerCase();
    rows = rows.filter((r) => `${r.customer}${r.city}${r.category}`.toLowerCase().includes(qq));
  }

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=requests.csv",
      "Cache-Control": "no-store",
    },
  });
}

