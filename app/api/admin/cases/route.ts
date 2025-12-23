import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/log-audit";
import {
  computeSlaDueAt,
  isSlaAtRisk,
  type SupportPriority,
} from "@/lib/support/sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateCaseSchema = z.object({
  user_id: z.string().uuid().optional().nullable(),
  provider_id: z.string().uuid().optional().nullable(),
  request_id: z.string().uuid().optional().nullable(),
  agreement_id: z.string().uuid().optional().nullable(),
  payment_id: z.string().uuid().optional().nullable(),
  type: z
    .enum([
      "pago",
      "servicio_no_realizado",
      "problema_tecnico",
      "reembolso",
      "queja",
      "otro",
    ])
    .optional()
    .default("otro"),
  priority: z
    .enum(["baja", "media", "alta", "critica"])
    .optional()
    .default("media"),
  status: z
    .enum(["nuevo", "en_proceso", "esperando_cliente", "resuelto", "cerrado"])
    .optional()
    .default("nuevo"),
  subject: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
});

const ListQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  assigned: z.string().optional(),
  q: z.string().optional(),
  slaRisk: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(200).optional().default(20),
});

function parseSlaRiskFlag(value?: string | null): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const parsed = ListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const { status, priority, type, assigned, q, slaRisk, page, pageSize } =
    parsed.data;
  const admin = getAdminSupabase();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("support_cases")
    .select("*", { count: "exact" })
    .order("last_activity_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (type) query = query.eq("type", type);
  if (assigned) {
    if (assigned === "unassigned") {
      query = query.is("assigned_admin_id", null);
    } else {
      query = query.eq("assigned_admin_id", assigned);
    }
  }
  if (q && q.trim().length > 0) {
    const like = `%${q.trim()}%`;
    query = query.or(`subject.ilike.${like},description.ilike.${like}`, {
      referencedTable: "support_cases",
    });
  }
  if (parseSlaRiskFlag(slaRisk)) {
    const now = Date.now();
    const soonCrit = new Date(now + 30 * 60 * 1000).toISOString();
    const soonMed = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    query = query.or(
      `and(priority.in.(critica,alta),sla_due_at.lte.${soonCrit}),and(priority.in.(media,baja),sla_due_at.lte.${soonMed})`,
      { referencedTable: "support_cases" },
    );
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: error.message },
      { status: 500, headers: JSONH },
    );
  }

  const cases = (data || []) as Array<Record<string, any>>;
  const userIds = new Set<string>();
  cases.forEach((c) => {
    if (c.user_id) userIds.add(c.user_id as string);
    if (c.assigned_admin_id) userIds.add(c.assigned_admin_id as string);
  });
  const profiles =
    userIds.size > 0
      ? await admin
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIds))
      : {
          data: [] as Array<{ id: string; full_name: string | null }>,
          error: null,
        };
  const nameMap = new Map<string, string | null>();
  profiles.data?.forEach((p: any) =>
    nameMap.set(p.id as string, (p.full_name as string) || null),
  );

  const items = cases.map((c) => ({
    ...c,
    short_id: (c.id as string).slice(0, 8),
    user_name: c.user_id ? (nameMap.get(c.user_id) ?? null) : null,
    assigned_name: c.assigned_admin_id
      ? (nameMap.get(c.assigned_admin_id) ?? null)
      : null,
    sla_risk: isSlaAtRisk(
      (c.priority as SupportPriority) ?? "media",
      c.sla_due_at,
    ),
  }));

  return NextResponse.json(
    { ok: true, items, page, pageSize, total: count ?? 0 },
    { status: 200, headers: JSONH },
  );
}

export async function POST(req: Request) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const body = await req.json().catch(() => ({}));
  const parsed = CreateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const admin = getAdminSupabase();
  const priority = parsed.data.priority;
  const sla_due_at = computeSlaDueAt(priority as SupportPriority).toISOString();

  const insertPayload = {
    ...parsed.data,
    channel_origin: "admin",
    sla_due_at,
    last_activity_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("support_cases")
    .insert(insertPayload)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", detail: error?.message },
      { status: 500, headers: JSONH },
    );
  }

  await admin.from("support_case_events").insert({
    case_id: data.id,
    kind: "system",
    channel: "admin",
    author_type: "system",
    body_text: "Caso creado manualmente",
    metadata: { source: "admin" },
  });

  await logAudit({
    actorId: gate.userId,
    action: "SUPPORT_CASE_CREATE",
    entity: "support_cases",
    entityId: data.id,
  });

  return NextResponse.json(
    { ok: true, case: data },
    { status: 201, headers: JSONH },
  );
}
