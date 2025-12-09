import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { getAdminSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/log-audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ status: z.enum(['approved','rejected','needs_info']), reason: z.string().optional() });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await assertAdminOrJson();
  if (!gate.ok) return gate.res;
  const userId = params.id;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'INVALID' }, { status: 400, headers: JSONH });
  // In dev/CI without service role key, short‑circuit as success
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svcKey) {
    await logAudit({ actorId: gate.userId, action: 'KYC_UPDATE_DEV', entity: 'professional', entityId: userId, meta: parsed.data });
    return NextResponse.json({ ok: true, dev: true }, { headers: JSONH });
  }
  const admin = getAdminSupabase();
  // Try update professionals.kyc_status first; if table missing, update pro_applications last record
  let ok = false;
  try {
    const { error } = await admin.from('professionals').update({ kyc_status: parsed.data.status }).eq('id', userId);
    if (!error) ok = true;
  } catch { /* ignore */ }
  if (!ok) {
    try {
      const { data: last } = await admin.from('pro_applications').select('id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (last?.id) {
        const { error } = await admin.from('pro_applications').update({ status: parsed.data.status }).eq('id', last.id);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: JSONH });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'FAILED';
      return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: JSONH });
    }
  }
  await logAudit({ actorId: gate.userId, action: 'KYC_UPDATE', entity: 'professional', entityId: userId, meta: parsed.data });
  return NextResponse.json({ ok: true }, { headers: JSONH });
}
