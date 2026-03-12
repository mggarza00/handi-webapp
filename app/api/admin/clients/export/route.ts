import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string | null;
};

const DAY_MS = 86_400_000;

function fakeRows(count: number): Row[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: crypto.randomUUID(),
    full_name: `Cliente ${i + 1}`,
    email: `cliente${i + 1}@handi.mx`,
    phone: `+52 55 0000 ${String(i).padStart(4, "0")}`,
    city: ["CDMX", "Monterrey", "Guadalajara"][i % 3]!,
    created_at: new Date(Date.now() - i * DAY_MS).toISOString(),
  }));
}

function matchesQuery(row: Row, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.id.toLowerCase().includes(needle) ||
    (row.full_name || "").toLowerCase().includes(needle) ||
    (row.email || "").toLowerCase().includes(needle) ||
    (row.phone || "").toLowerCase().includes(needle)
  );
}

function matchesCity(row: Row, city: string): boolean {
  if (!city) return true;
  return (row.city || "").toLowerCase() === city.toLowerCase();
}

function toCSV(rows: Row[]): string {
  const escape = (value: unknown) => {
    const str = (value ?? "").toString();
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const header = [
    "id",
    "full_name",
    "email",
    "phone",
    "city",
    "created_at",
  ].join(",");
  const lines = rows.map((row) =>
    [
      row.id,
      row.full_name || "",
      row.email || "",
      row.phone || "",
      row.city || "",
      row.created_at || "",
    ]
      .map(escape)
      .join(","),
  );

  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let rows: Row[] = [];

  if (!svcKey) {
    rows = fakeRows(120)
      .filter((row) => matchesCity(row, city))
      .filter((row) => matchesQuery(row, q));
  } else {
    let query = getAdminSupabase()
      .from("profiles")
      .select("id, full_name, email, phone, city, created_at, role")
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(10000);

    if (city) query = query.eq("city", city);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: JSONH },
      );
    }

    rows = ((data || []) as Row[]).filter((row) => matchesQuery(row, q));
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
