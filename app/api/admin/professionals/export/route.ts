import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  cities: string[] | null;
  rating: number | null;
};

type BaseRow = {
  id: string;
  full_name?: string | null;
  rating?: number | null;
  categories?: unknown;
  cities?: unknown;
  subcategories?: unknown;
  city?: unknown;
};

function normalizeStringArray(value: unknown): string[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const out = value
      .map((v) => (typeof v === "string" ? v : String(v || "")))
      .map((v) => v.trim())
      .filter(Boolean);
    return out.length ? out : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeStringArray(parsed);
    } catch {
      return [trimmed];
    }
  }
  return null;
}

function normalizeCities(row: BaseRow): string[] | null {
  return (
    normalizeStringArray(row.cities) || normalizeStringArray(row.city) || null
  );
}

function normalizeCategories(row: BaseRow): string[] | null {
  return (
    normalizeStringArray(row.categories) ||
    normalizeStringArray(row.subcategories) ||
    null
  );
}

function toCSV(rows: Row[]): string {
  const esc = (v: unknown) => {
    const s = (v ?? "").toString();
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "id",
    "full_name",
    "email",
    "phone",
    "categories",
    "cities",
    "rating",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.id,
      r.full_name,
      r.email || "",
      r.phone || "",
      (r.categories || []).join("; "),
      (r.cities || []).join("; "),
      r.rating ?? "",
    ]
      .map(esc)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

function fake(n: number): Row[] {
  return Array.from({ length: n }).map((_, i) => ({
    id: crypto.randomUUID(),
    full_name: `Profesional ${i + 1}`,
    email: `pro${i + 1}@handi.mx`,
    phone: `+52 81 0000 00${String(i).padStart(2, "0")}`,
    categories: ["Plomería", "Electricidad", "Pintura"].slice(0, (i % 3) + 1),
    cities: ["CDMX", "Monterrey", "Guadalajara"].slice(0, (i % 3) + 1),
    rating:
      Math.random() > 0.2
        ? ((3 + Math.random() * 2).toFixed(1) as unknown as number)
        : null,
  }));
}

async function fetchBaseAll(
  admin: ReturnType<typeof getAdminSupabase>,
): Promise<BaseRow[]> {
  const selectFull =
    "id, full_name, rating, categories, cities, subcategories, city";
  const selectMinimal = "id, categories, cities, subcategories, city";

  const tryView = async (select: string) =>
    admin.from("professionals_with_profile").select(select).range(0, 10000);
  const tryTable = async (select: string) =>
    admin.from("professionals").select(select).range(0, 10000);

  let res = await tryView(selectFull);
  if (res.error) res = await tryView(selectMinimal);
  if (!res.error) return (res.data as BaseRow[]) || [];

  res = await tryTable(selectFull);
  if (res.error) res = await tryTable(selectMinimal);
  if (res.error) throw res.error;
  return (res.data as BaseRow[]) || [];
}

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!svcKey) {
    const csv = toCSV(fake(60));
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=professionals.csv",
        "Cache-Control": "no-store",
      },
    });
  }

  const admin = getAdminSupabase();
  let baseRows: BaseRow[] = [];
  try {
    baseRows = await fetchBaseAll(admin);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String((err as Error)?.message || err) },
      { status: 500, headers: JSONH },
    );
  }

  const userIds = baseRows.map((r) => r.id).filter(Boolean);

  let profiles: Array<{
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    rating?: number | null;
  }> = [];
  try {
    const res = await admin
      .from("profiles")
      .select("id, full_name, email, phone, rating")
      .in("id", userIds);
    if (!res.error) profiles = (res.data as typeof profiles) || [];
  } catch {
    const res = await admin
      .from("profiles")
      .select("id, full_name, email, rating")
      .in("id", userIds);
    if (!res.error) profiles = (res.data as typeof profiles) || [];
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  let appMap = new Map<
    string,
    { email?: string | null; phone?: string | null }
  >();
  try {
    const { data: apps } = await admin
      .from("pro_applications")
      .select("user_id, email, phone, status, updated_at")
      .in("user_id", userIds)
      .in("status", ["accepted", "approved"])
      .order("updated_at", { ascending: false });
    for (const app of apps || []) {
      if (!app?.user_id) continue;
      if (!appMap.has(app.user_id)) {
        appMap.set(app.user_id, {
          email: app.email || null,
          phone: app.phone || null,
        });
      }
    }
  } catch {
    appMap = new Map();
  }

  const rows: Row[] = baseRows.map((row) => {
    const profile = profileMap.get(row.id);
    const fallback = appMap.get(row.id);
    return {
      id: row.id,
      full_name:
        profile?.full_name || row.full_name || `Usuario ${row.id.slice(0, 6)}`,
      email: profile?.email || fallback?.email || null,
      phone: profile?.phone || fallback?.phone || null,
      categories: normalizeCategories(row),
      cities: normalizeCities(row),
      rating: profile?.rating ?? row.rating ?? null,
    };
  });

  const csv = toCSV(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=professionals.csv",
      "Cache-Control": "no-store",
    },
  });
}
