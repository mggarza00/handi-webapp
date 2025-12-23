import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/log-audit";
import { computeSlaDueAt, type SupportPriority } from "@/lib/support/sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z
    .enum(["nuevo", "en_proceso", "esperando_cliente", "resuelto", "cerrado"])
    .optional(),
  priority: z.enum(["baja", "media", "alta", "critica"]).optional(),
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
  subject: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  assigned_admin_id: z.string().uuid().nullable().optional(),
});

async function fetchContext(
  admin: ReturnType<typeof getAdminSupabase>,
  caseId: string,
) {
  const [{ data: sc }, { data: events }] = await Promise.all([
    admin.from("support_cases").select("*").eq("id", caseId).maybeSingle(),
    admin
      .from("support_case_events")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
  ]);

  if (!sc) return { case: null, events: [] };

  // Contexto opcional best-effort
  const [profile, provider, request, agreement, payment, assigned] =
    await Promise.all([
      sc.user_id
        ? admin
            .from("profiles")
            .select("id, full_name, role, phone")
            .eq("id", sc.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sc.provider_id
        ? admin
            .from("profiles")
            .select("id, full_name, role, phone")
            .eq("id", sc.provider_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sc.request_id
        ? admin
            .from("requests")
            .select("id, title, status")
            .eq("id", sc.request_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sc.agreement_id
        ? admin
            .from("agreements")
            .select("id, status")
            .eq("id", sc.agreement_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sc.payment_id
        ? admin
            .from("payments")
            .select("id, status, amount, currency")
            .eq("id", sc.payment_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      sc.assigned_admin_id
        ? admin
            .from("profiles")
            .select("id, full_name")
            .eq("id", sc.assigned_admin_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return {
    case: sc,
    events: events ?? [],
    context: {
      user: profile?.data ?? null,
      provider: provider?.data ?? null,
      request: request?.data ?? null,
      agreement: agreement?.data ?? null,
      payment: payment?.data ?? null,
      assigned: assigned?.data ?? null,
    },
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const admin = getAdminSupabase();
  const ctx = await fetchContext(admin, params.id);
  if (!ctx.case) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      case: ctx.case,
      events: ctx.events,
      context: ctx.context,
      viewer_admin_id: gate.userId,
    },
    { status: 200, headers: JSONH },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  const { data: current } = await admin
    .from("support_cases")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND" },
      { status: 404, headers: JSONH },
    );
  }

  const updates: Record<string, unknown> = {};
  const events: Array<{
    kind: string;
    body_text?: string | null;
    metadata?: Record<string, unknown>;
  }> = [];

  if (parsed.data.status && parsed.data.status !== current.status) {
    updates.status = parsed.data.status;
    events.push({
      kind: "status_change",
      body_text: `Estatus: ${current.status} -> ${parsed.data.status}`,
    });
  }
  if (parsed.data.priority && parsed.data.priority !== current.priority) {
    updates.priority = parsed.data.priority;
    updates.sla_due_at = computeSlaDueAt(
      parsed.data.priority as SupportPriority,
    ).toISOString();
  }
  if (parsed.data.type && parsed.data.type !== current.type)
    updates.type = parsed.data.type;
  if ("subject" in parsed.data && parsed.data.subject !== undefined)
    updates.subject = parsed.data.subject;
  if ("description" in parsed.data && parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (
    "assigned_admin_id" in parsed.data &&
    parsed.data.assigned_admin_id !== current.assigned_admin_id
  ) {
    updates.assigned_admin_id = parsed.data.assigned_admin_id;
    events.push({
      kind: "assignment",
      body_text: parsed.data.assigned_admin_id
        ? "Caso asignado"
        : "Caso sin asignar",
      metadata: {
        previous: current.assigned_admin_id,
        next: parsed.data.assigned_admin_id,
      },
    });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: true, case: current },
      { status: 200, headers: JSONH },
    );
  }

  updates.last_activity_at = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("support_cases")
    .update(updates)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: error?.message },
      { status: 500, headers: JSONH },
    );
  }

  if (events.length) {
    await admin.from("support_case_events").insert(
      events.map((e) => ({
        case_id: params.id,
        kind: e.kind,
        channel: "admin",
        author_type: "admin",
        author_id: gate.userId,
        body_text: e.body_text ?? null,
        metadata: e.metadata ?? {},
      })),
    );
  }

  await logAudit({
    actorId: gate.userId,
    action: "SUPPORT_CASE_UPDATE",
    entity: "support_cases",
    entityId: params.id,
    meta: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json(
    { ok: true, case: updated },
    { status: 200, headers: JSONH },
  );
}
