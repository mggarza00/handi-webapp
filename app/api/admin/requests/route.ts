import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CITIES = ["CDMX", "Monterrey", "Guadalajara", "Querétaro", "Puebla"];
const CATS = ["Limpieza", "Plomería", "Electricidad", "Pintura", "Carpintería"];
const STATUS = ["active", "in_process", "completed", "cancelled"] as const;

export type AdminRequest = {
  id: string;
  folio: number;
  customer_name: string;
  city: string;
  category: string;
  subcategory: string | null;
  budget: number | null;
  status: typeof STATUS[number];
  created_at: string;
};

function fake(n: number): AdminRequest[] {
  const arr: AdminRequest[] = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      id: crypto.randomUUID(),
      folio: 1000 + i,
      customer_name: `Cliente ${i + 1}`,
      city: CITIES[i % CITIES.length],
      category: CATS[i % CATS.length],
      subcategory: null,
      budget: Math.random() > 0.3 ? Math.floor(500 + Math.random() * 5000) : null,
      status: STATUS[i % STATUS.length],
      created_at: new Date(Date.now() - i * 3600_000).toISOString(),
    });
  }
  return arr;
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = new URL(req.url);
  if (!svcKey) {
    const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10) || 20;
    const start = (page - 1) * pageSize;
    const data = fake(start + pageSize).slice(start, start + pageSize);
    return NextResponse.json({ ok: true, items: data, page, pageSize, total: 500 }, { headers: JSONH });
  }

  const admin = getAdminSupabase();
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20);
  const status = url.searchParams.get("status");
  const city = url.searchParams.get("city");
  const category = url.searchParams.get("category");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const minBudget = url.searchParams.get("minBudget");
  const maxBudget = url.searchParams.get("maxBudget");

  let base = admin
    .from("requests")
    .select("id, created_at, city, category, budget, status, created_by", { count: "exact" });
  if (status) base = base.eq("status", status);
  if (city) base = base.eq("city", city);
  if (category) base = base.eq("category", category);
  if (from) base = base.gte("created_at", new Date(from).toISOString());
  if (to) base = base.lte("created_at", new Date(to).toISOString());
  if (minBudget) base = base.gte("budget", Number(minBudget));
  if (maxBudget) base = base.lte("budget", Number(maxBudget));

  // Sorting (whitelist columns)
  const sortBy = (url.searchParams.get("sortBy") || "created_at") as string;
  const sortDir = (url.searchParams.get("sortDir") || "desc").toLowerCase() === 'asc' ? 'asc' : 'desc';
  const allowed = new Set(["created_at","budget","city","category","status"]);
  base = base.order(allowed.has(sortBy) ? sortBy : "created_at", { ascending: sortDir === 'asc' });

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const { data: reqs, error, count } = await base.range(fromIdx, toIdx);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  const ids = Array.from(new Set((reqs || []).map((r) => r.created_by))).filter(Boolean) as string[];
  let names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    names = new Map((profs || []).map((p) => [p.id as string, (p.full_name as string | null) || "—"]));
  }
  const items = (reqs || []).map((r, i) => ({
    id: r.id,
    folio: fromIdx + i + 1000,
    customer_name: names.get(r.created_by) || r.created_by,
    city: r.city || "—",
    category: r.category || "—",
    subcategory: null,
    budget: r.budget as number | null,
    status: (r.status as unknown as "active" | "in_process" | "completed" | "cancelled" | null) || "active",
    created_at: r.created_at as string,
  }));
  return NextResponse.json({ ok: true, items, page, pageSize, total: count ?? items.length }, { headers: JSONH });
}

