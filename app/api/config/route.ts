import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  commission_client: z.number().min(0).max(100),
  commission_pro: z.number().min(0).max(100),
  vat: z.number().min(0).max(100),
});

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("config").select("id, commission_client, commission_pro, vat, updated_at").eq("id", 1).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, config: data }, { headers: JSONH });
}

export async function PUT(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400, headers: JSONH });
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("config")
    .upsert({ id: 1, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  await admin.from("audit_log").insert({ actor_id: gate.userId, action: "CONFIG_UPDATE", entity: "config", entity_id: "1", meta: parsed.data as unknown as Record<string, unknown> });
  return NextResponse.json({ ok: true }, { headers: JSONH });
}

