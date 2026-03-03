import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";
import { getRatingsForPros } from "@/lib/admin/pro-rating";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPro = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  cities: string[] | null;
  ratingAvg: number | null;
  reviewsCount: number;
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

function normalizeStringList(value: unknown): string[] {
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    if (!raw) return;
    const s = String(raw).trim();
    if (!s) return;
    seen.add(s);
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        if (obj.name) push(obj.name);
        else if (obj.label) push(obj.label);
        else if (obj.value) push(obj.value);
      }
    }
  } else if (typeof value === "string") {
    push(value);
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.name) push(obj.name);
    else if (obj.label) push(obj.label);
    else if (obj.value) push(obj.value);
  }
  return Array.from(seen);
}

function normalizeCities(row: BaseRow): string[] | null {
  const list = [
    ...normalizeStringList(row.cities),
    ...normalizeStringList(row.city),
  ];
  return list.length ? list : null;
}

function normalizeCategories(row: BaseRow): string[] | null {
  const list = [
    ...normalizeStringList(row.categories),
    ...normalizeStringList(row.subcategories),
  ];
  return list.length ? list : null;
}

function fake(n: number): AdminPro[] {
  const arr: AdminPro[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: crypto.randomUUID(),
      full_name: `Profesional ${i + 1}`,
      email: `pro${i + 1}@handi.mx`,
      phone: `+52 81 0000 00${String(i).padStart(2, "0")}`,
      categories: ["Plomería", "Electricidad", "Pintura"].slice(0, (i % 3) + 1),
      cities: ["CDMX", "Monterrey", "Guadalajara"].slice(0, (i % 3) + 1),
      ratingAvg:
        Math.random() > 0.2 ? +(3 + Math.random() * 2).toFixed(1) : null,
      reviewsCount: Math.floor(Math.random() * 20),
    });
  }
  return arr;
}

async function fetchBaseList(
  admin: ReturnType<typeof getAdminSupabase>,
  from: number,
  to: number,
): Promise<{ rows: BaseRow[]; total: number }> {
  const selectFull =
    "id, full_name, rating, categories, cities, subcategories, city";
  const selectMinimal = "id, categories, cities, subcategories, city";

  const tryView = async (select: string) =>
    admin
      .from("professionals_with_profile")
      .select(select, { count: "exact" })
      .range(from, to);
  const tryTable = async (select: string) =>
    admin
      .from("professionals")
      .select(select, { count: "exact" })
      .range(from, to);

  let res = await tryView(selectFull);
  if (res.error) res = await tryView(selectMinimal);
  if (!res.error) {
    return { rows: (res.data as BaseRow[]) || [], total: res.count || 0 };
  }

  res = await tryTable(selectFull);
  if (res.error) res = await tryTable(selectMinimal);
  if (res.error) {
    throw res.error;
  }
  return { rows: (res.data as BaseRow[]) || [], total: res.count || 0 };
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    const all = fake(60);
    const items = all.slice(from, to + 1);
    return NextResponse.json(
      { ok: true, items, total: all.length, page, pageSize },
      { headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  let base: { rows: BaseRow[]; total: number };
  try {
    base = await fetchBaseList(admin, from, to);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String((err as Error)?.message || err) },
      { status: 500, headers: JSONH },
    );
  }

  const userIds = base.rows.map((r) => r.id).filter(Boolean);

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

  const ratingsMap = await getRatingsForPros(userIds);

  const items: AdminPro[] = base.rows.map((row) => {
    const profile = profileMap.get(row.id);
    const fallback = appMap.get(row.id);
    const ratingAgg = ratingsMap[row.id];
    const fallbackRating =
      typeof profile?.rating === "number"
        ? profile.rating
        : typeof row.rating === "number"
          ? row.rating
          : null;
    return {
      id: row.id,
      full_name:
        profile?.full_name || row.full_name || `Usuario ${row.id.slice(0, 6)}`,
      email: profile?.email || fallback?.email || null,
      phone: profile?.phone || fallback?.phone || null,
      categories: normalizeCategories(row),
      cities: normalizeCities(row),
      ratingAvg: ratingAgg?.ratingAvg ?? fallbackRating,
      reviewsCount: ratingAgg?.reviewsCount ?? 0,
    };
  });

  return NextResponse.json(
    { ok: true, items, total: base.total, page, pageSize },
    { headers: JSONH },
  );
}
