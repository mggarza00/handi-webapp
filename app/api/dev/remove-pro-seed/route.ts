import { NextResponse } from "next/server";
import { assertAdminOrJson, JSONH } from "@/lib/auth-admin";
import { createServerClient } from "@/lib/supabase";

type AuthUserLite = { id: string; email?: string | null };

async function findUserByEmail(email: string): Promise<AuthUserLite | null> {
  const supa = createServerClient();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>;
    const found = users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found) return { id: found.id, email: found.email ?? null };
    if (!users.length || users.length < perPage) break;
  }
  return null;
}

export async function POST() {
  const auth = await assertAdminOrJson();
  if (!auth.ok) return auth.res;

  const supa = createServerClient();
  const ids: string[] = [];

  // Try by known email
  try {
    const pro = await findUserByEmail("pro+seed@homaid.dev");
    if (pro?.id) ids.push(pro.id);
  } catch {
    // ignore
  }

  // Fallback by profile name
  try {
    const { data } = await supa.from("profiles").select("id, full_name").ilike("full_name", "Pro Seed");
    const rows = (data || []) as Array<{ id?: string | null; full_name?: string | null }>;
    for (const r of rows) {
      const rid = typeof r?.id === 'string' ? r.id : null;
      if (rid && !ids.includes(rid)) ids.push(rid);
    }
  } catch {
    // ignore
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 }, { headers: JSONH });
  }

  // Best-effort: delete related rows first
  try {
    await supa.from("applications").delete().in("professional_id", ids);
  } catch {}
  try {
    await supa.from("professionals").delete().in("id", ids);
  } catch {}
  try {
    await supa.from("profiles").delete().in("id", ids);
  } catch {}

  // Delete auth users
  const removed: string[] = [];
  for (const id of ids) {
    try {
      await supa.auth.admin.deleteUser(id);
      removed.push(id);
    } catch {
      // ignore per-user errors
    }
  }

  return NextResponse.json({ ok: true, removed: removed.length }, { headers: JSONH });
}
