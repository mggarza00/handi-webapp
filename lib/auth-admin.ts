import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";

export const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function isEmailAllowed(email?: string | null): boolean {
  if (!email) return false;
  const seed = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const e = email.toLowerCase();
  return (seed && e === seed) || list.includes(e);
}

export async function assertAdminOrJson(): Promise<
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse<{ ok: false; error: string }> }
> {
  const supa = createSupabaseServerClient();
  const { data: auth } = await supa.auth.getUser();
  const user = auth?.user;

  // DEV/CI bypass: permite cookie 'handi_role' con rol de admin en entornos no productivos
  if (!user) {
    const allowDev = process.env.NODE_ENV !== "production" || process.env.CI === "true";
    if (allowDev) {
      const role = (cookies().get("handi_role")?.value || "").toLowerCase();
      const allowed = new Set(["owner", "admin", "ops", "finance", "support", "reviewer"]);
      if (role && allowed.has(role)) {
        return { ok: true, userId: "dev-admin" };
      }
    }
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      ),
    };
  }

  // Try to read role and optional is_admin; fallback gracefully if column is missing
  let role: string | null = null;
  let is_admin: boolean | null = null;
  try {
    const { data } = await supa
      .from("profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    role = (data as unknown as { role?: string | null } | null)?.role ?? null;
    is_admin = (data as unknown as { is_admin?: boolean | null } | null)?.is_admin ?? null;
  } catch {
    const { data } = await supa
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = (data as unknown as { role?: string | null } | null)?.role ?? null;
  }

  const allowed = is_admin === true || role === "admin" || isEmailAllowed(user.email);
  if (!allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      ),
    };
  }

  return { ok: true, userId: user.id };
}
