import { NextResponse } from "next/server";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const status = url.searchParams.get("status");
  const admin = getAdminSupabase();
  let q = admin.from("webhooks_log").select("id, provider, event, status_code, created_at").order("created_at", { ascending: false }).limit(200);
  if (provider) q = q.eq("provider", provider);
  if (status) q = q.eq("status_code", Number(status));
  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, items: data }, { headers: JSONH });
}

