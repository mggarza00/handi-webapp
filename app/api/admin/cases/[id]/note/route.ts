import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/log-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  body_text: z.string().min(1).max(4000),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  const { data: exists } = await admin
    .from("support_cases")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!exists) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await admin.from("support_case_events").insert({
    case_id: params.id,
    kind: "internal_note",
    channel: "admin",
    author_type: "admin",
    author_id: gate.userId,
    body_text: parsed.data.body_text,
    metadata: {},
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: error.message },
      { status: 500, headers: JSONH },
    );
  }

  await admin
    .from("support_cases")
    .update({ last_activity_at: nowIso })
    .eq("id", params.id);

  await logAudit({
    actorId: gate.userId,
    action: "SUPPORT_CASE_NOTE",
    entity: "support_cases",
    entityId: params.id,
  });

  return NextResponse.json({ ok: true }, { status: 201, headers: JSONH });
}
