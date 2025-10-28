import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminClient = {
  id: string;
  full_name: string | null;
  city: string | null;
  created_at: string | null;
};

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    // Minimal mock when no service role is configured
    const items: AdminClient[] = Array.from({ length: 12 }).map((_, i) => ({
      id: crypto.randomUUID(),
      full_name: `Cliente ${i + 1}`,
      city: ["CDMX", "Monterrey", "Guadalajara"][i % 3]!,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));
    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const city = (url.searchParams.get("city") || "").trim();

  const admin = getAdminSupabase();
  let query = admin
    .from("profiles")
    .select("id, full_name, city, created_at, role")
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .limit(100);

  if (city) query = query.eq("city", city);
  // Nota: para filtro por nombre se podría usar ilike en server si existe índice adecuado
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });

  let items = (data || []) as unknown as AdminClient[];
  if (q) {
    const qq = q.toLowerCase();
    items = items.filter((c) => (c.full_name || "").toLowerCase().includes(qq) || c.id.toLowerCase().includes(qq));
  }
  return NextResponse.json({ ok: true, items }, { headers: JSONH });
}

