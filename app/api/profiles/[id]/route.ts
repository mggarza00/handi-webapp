import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

type CtxP = { params: Promise<{ id: string }> };

const IdSchema = z.string().uuid();

export async function GET(_req: Request, { params }: CtxP) {
  const { id } = await params;
  const parsed = IdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: JSONH });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !serviceRole) {
    return NextResponse.json({ ok: false, error: "SERVER_MISCONFIGURED" }, { status: 500, headers: JSONH });
  }

  const admin = createClient<Database>(url, serviceRole);
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, headline, bio, rating, years_experience, city, categories, subcategories, last_active_at, is_featured")
    .eq("id", parsed.data)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", detail: error?.message }, { status: 404, headers: JSONH });
  }

  // Nunca exponer datos sensibles (sólo campos públicos definidos arriba)
  return NextResponse.json({ ok: true, data }, { headers: JSONH });
}
