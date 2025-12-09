import { getAdminSupabase } from "@/lib/supabase/server";

export async function logAudit({ actorId, action, entity, entityId, meta }: {
  actorId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    const admin = getAdminSupabase();
    await admin.from('audit_log').insert({
      actor_id: actorId ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      meta: (meta as unknown) as Record<string, unknown>,
    });
  } catch {
    // best-effort only
  }
}

