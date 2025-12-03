import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import createClient from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, items: data }, { headers: JSONH });
}
