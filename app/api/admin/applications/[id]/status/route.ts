/* eslint-disable import/order */
import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import { z } from "zod";

import type { Database } from "@/types/supabase";
import { getAdminSupabase } from "../../../../../../lib/supabase/admin";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

const Schema = z.object({
  status: z.enum(["applied", "accepted", "rejected"]),
});

async function assertIsAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; res: NextResponse }
> {
  const supa = createClient();
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: JSONH },
      ),
    };
  }
  const { data: prof } = await supa
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const allowEmail = process.env.SEED_ADMIN_EMAIL as string | undefined;
  const isAdmin =
    (prof as any)?.role === "admin" ||
    (allowEmail && auth.user.email?.toLowerCase() === allowEmail.toLowerCase());
  if (!isAdmin) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403, headers: JSONH },
      ),
    };
  }
  return { ok: true, userId: auth.user.id };
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const guard = await assertIsAdmin();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR" },
      { status: 422, headers: JSONH },
    );
  }
  const admin = getAdminSupabase();
  const { id } = params;
  const { status } = parsed.data;
  const upd = await admin
    .from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,status,updated_at")
    .single();
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: "UPDATE_FAILED", detail: upd.error.message },
      { status: 500, headers: JSONH },
    );
  }
  return NextResponse.json({ ok: true, data: upd.data }, { status: 200, headers: JSONH });
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
