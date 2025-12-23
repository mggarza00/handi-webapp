import { NextResponse } from "next/server";
import { z } from "zod";

import { JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { computeSlaDueAt, type SupportPriority } from "@/lib/support/sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  case_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  type: z
    .enum([
      "pago",
      "servicio_no_realizado",
      "problema_tecnico",
      "reembolso",
      "queja",
      "otro",
    ])
    .optional(),
  priority: z.enum(["baja", "media", "alta", "critica"]).optional(),
  status: z
    .enum(["nuevo", "en_proceso", "esperando_cliente", "resuelto", "cerrado"])
    .optional(),
  message_text: z.string().max(4000).optional(),
});

const INTERNAL_KEY = process.env.INTERNAL_ASSISTANT_KEY || "";

function assertInternalAuth(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  return INTERNAL_KEY.length > 0 && token === INTERNAL_KEY;
}

export async function POST(req: Request) {
  if (!assertInternalAuth(req)) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403, headers: JSONH },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  const nowIso = new Date().toISOString();
  const { case_id, user_id, type, priority, status, message_text } =
    parsed.data;

  let caseId = case_id || null;
  if (caseId) {
    const { data: exists } = await admin
      .from("support_cases")
      .select("id")
      .eq("id", caseId)
      .maybeSingle();
    if (!exists) caseId = null;
  }

  if (!caseId) {
    const pri = (priority as SupportPriority) || "media";
    const ins = await admin
      .from("support_cases")
      .insert({
        user_id: user_id ?? null,
        channel_origin: "assistant",
        type: type ?? "otro",
        priority: pri,
        status: status ?? "nuevo",
        sla_due_at: computeSlaDueAt(pri).toISOString(),
        last_activity_at: nowIso,
        subject: message_text
          ? message_text.slice(0, 120)
          : "Nuevo caso asistente",
        description: message_text ?? null,
      })
      .select("id")
      .maybeSingle();
    caseId = ins.data?.id ?? null;
  } else if (status || priority) {
    const upd: Record<string, unknown> = {};
    if (status) upd.status = status;
    if (priority) upd.priority = priority;
    await admin.from("support_cases").update(upd).eq("id", caseId);
  }

  if (!caseId) {
    return NextResponse.json(
      { ok: false, error: "CASE_NOT_CREATED" },
      { status: 500, headers: JSONH },
    );
  }

  if (message_text) {
    await admin.from("support_case_events").insert({
      case_id: caseId,
      kind: "message_in",
      channel: "assistant",
      author_type: "system",
      body_text: message_text,
      metadata: {},
      created_at: nowIso,
    });
    await admin
      .from("support_cases")
      .update({ last_activity_at: nowIso })
      .eq("id", caseId);
  }

  return NextResponse.json(
    { ok: true, case_id: caseId },
    { status: 200, headers: JSONH },
  );
}
