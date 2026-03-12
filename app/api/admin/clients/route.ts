import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminClient = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string | null;
  avatar_url: string | null;
};

const MAX_PAGE_SIZE = 100;
const MOCK_SIZE = 120;
const DAY_MS = 86_400_000;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

function fakeClients(count: number): AdminClient[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: crypto.randomUUID(),
    full_name: `Cliente ${i + 1}`,
    email: `cliente${i + 1}@handi.mx`,
    phone: `+52 55 0000 ${String(i).padStart(4, "0")}`,
    city: ["CDMX", "Monterrey", "Guadalajara"][i % 3]!,
    created_at: new Date(Date.now() - i * DAY_MS).toISOString(),
    avatar_url:
      i % 2 === 0 ? `public/avatars/clientes/avatar-${(i % 6) + 1}.png` : null,
  }));
}

function matchesQuery(client: AdminClient, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    client.id.toLowerCase().includes(needle) ||
    (client.full_name || "").toLowerCase().includes(needle) ||
    (client.email || "").toLowerCase().includes(needle) ||
    (client.phone || "").toLowerCase().includes(needle)
  );
}

function matchesCity(client: AdminClient, city: string): boolean {
  if (!city) return true;
  return (client.city || "").toLowerCase() === city.toLowerCase();
}

function paginate<T>(list: T[], page: number, pageSize: number): T[] {
  const from = (page - 1) * pageSize;
  return list.slice(from, from + pageSize);
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const rawPageSize = parsePositiveInt(url.searchParams.get("pageSize"), 20);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    const all = fakeClients(MOCK_SIZE)
      .filter((client) => matchesCity(client, city))
      .filter((client) => matchesQuery(client, q));
    const items = paginate(all, page, pageSize);
    return NextResponse.json(
      {
        ok: true,
        items,
        total: all.length,
        page,
        pageSize,
      },
      { headers: JSONH },
    );
  }

  const admin = getAdminSupabase();

  if (q) {
    let query = admin
      .from("profiles")
      .select("id, full_name, email, phone, city, created_at, avatar_url, role")
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (city) query = query.eq("city", city);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500, headers: JSONH },
      );
    }

    const filtered = ((data || []) as AdminClient[]).filter((client) =>
      matchesQuery(client, q),
    );

    return NextResponse.json(
      {
        ok: true,
        items: paginate(filtered, page, pageSize),
        total: filtered.length,
        page,
        pageSize,
      },
      { headers: JSONH },
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("profiles")
    .select("id, full_name, email, phone, city, created_at, avatar_url, role", {
      count: "exact",
    })
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (city) query = query.eq("city", city);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: JSONH },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      items: (data || []) as AdminClient[],
      total: count || 0,
      page,
      pageSize,
    },
    { headers: JSONH },
  );
}
