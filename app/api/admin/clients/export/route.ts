import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  full_name: string | null;
  city: string | null;
  created_at: string | null;
};

function toCSV(rows: Row[]): string {
  const escape = (v: unknown) => {
    const s = (v ?? "").toString();
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = ["id", "full_name", "city", "created_at"].join(",");
  const lines = rows.map((r) => [r.id, r.full_name || "", r.city || "", r.created_at || ""].map(escape).join(","));
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let rows: Row[] = [];
  if (!svcKey) {
    rows = Array.from({ length: 10 }).map((_, i) => ({
      id: crypto.randomUUID(),
      full_name: `Cliente ${i + 1}`,
      city: ["CDMX", "Monterrey", "Guadalajara"][i % 3]!,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
  } else {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const city = (url.searchParams.get("city") || "").trim();

    const admin = getAdminSupabase();
    let query = admin
      .from("profiles")
      .select("id, full_name, city, created_at, role")
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (city) query = query.eq("city", city);
    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
    rows = (data || []) as unknown as Row[];
    if (q) {
      const qq = q.toLowerCase();
      rows = rows.filter((c) => (c.full_name || "").toLowerCase().includes(qq) || c.id.toLowerCase().includes(qq));
    }
  }

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=clients.csv",
      "Cache-Control": "no-store",
    },
  });
}

