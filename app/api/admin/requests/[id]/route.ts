import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/log-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const admin = getAdminSupabase();
  const id = params.id;
  const { data, error } = await admin.from('requests').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  if (!data) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404, headers: JSONH });
  const { data: pays } = await admin.from('payments').select('id, amount, currency, status, created_at').eq('request_id', id).order('created_at', { ascending: false });
  return NextResponse.json({ ok: true, request: data, payments: pays || [] }, { headers: JSONH });
}

const PatchSchema = z.object({
  status: z.string().optional(),
  scheduled_for: z.string().datetime().optional(),
  professional_id: z.string().uuid().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const admin = getAdminSupabase();
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400, headers: JSONH });
  const patch: Record<string, unknown> = {};
  if (parsed.data.status) patch.status = parsed.data.status;
  if (parsed.data.scheduled_for) patch.scheduled_for = parsed.data.scheduled_for;
  if (parsed.data.professional_id) patch.professional_id = parsed.data.professional_id;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: 'EMPTY' }, { status: 400, headers: JSONH });
  const { error } = await admin.from('requests').update(patch).eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
  await logAudit({ actorId: gate.userId, action: 'REQUEST_UPDATE', entity: 'requests', entityId: id, meta: patch });
  return NextResponse.json({ ok: true }, { headers: JSONH });
}

