import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    const statuses = [
      "published",
      "offered",
      "paid",
      "scheduled",
      "in_process",
      "completed",
      "rated",
      "canceled_by_client",
      "canceled_by_pro",
      "refunded",
      "disputed",
    ];
    const items = statuses.map((s) => ({ status: s, cnt: Math.floor(Math.random() * 100) }));
    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  }

  const admin = getAdminSupabase();
  try {
    const { data, error } = await admin.from("v_kpi_funnel_last_30d").select("status, cnt");
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data }, { headers: JSONH });
  } catch {
    // fallback to jobs aggregation
    const { data } = await admin
      .from("jobs")
      .select("status")
      .gte("requested_at", new Date(Date.now() - 30 * 86400000).toISOString());
    const map = new Map<string, number>();
    for (const r of data || []) {
      const k = String((r as { status: string }).status);
      map.set(k, (map.get(k) || 0) + 1);
    }
    const items = Array.from(map.entries()).map(([status, cnt]) => ({ status, cnt }));
    return NextResponse.json({ ok: true, items }, { headers: JSONH });
  }
}

