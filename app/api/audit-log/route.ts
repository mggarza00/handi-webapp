import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, items: data }, { headers: JSONH });
}

