import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const supabase = getRouteClient();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("id, commission_percent, vat_percent, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  return NextResponse.json({ ok: true, settings: data }, { headers: JSONH });
}

const payloadSchema = z.object({
  commission_percent: z.number().min(0).max(100),
  vat_percent: z.number().min(0).max(100),
});

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const body = await req.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID" }, { status: 400, headers: JSONH });
  }
  const supabase = getRouteClient();
  const { commission_percent, vat_percent } = parsed.data;
  const { error: upErr } = await supabase
    .from("admin_settings")
    .upsert({ id: 1, commission_percent, vat_percent, updated_by: gate.userId, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500, headers: JSONH });

  // Audit log
  await supabase
    .from("audit_log")
    .insert({
      action: "SETTINGS_UPDATE",
      actor_id: gate.userId,
      // meta es jsonb en BD; castear a unknown evita 'any'
      meta: ({ commission_percent, vat_percent } as unknown) as Record<string, unknown>,
    });
  return NextResponse.json({ ok: true }, { headers: JSONH });
}
