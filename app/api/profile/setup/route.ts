import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import { ProfileUpsertSchema } from "@/lib/validators/profiles";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401, headers: JSONH });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400, headers: JSONH });
  }

  const parsed = ProfileUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
  }

  const input = parsed.data;

  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    full_name: input.full_name ?? null,
    avatar_url: input.avatar_url ?? null,
    headline: input.headline ?? null,
    bio: input.bio ?? null,
    years_experience: input.years_experience ?? null,
    city: input.city ?? null,
    cities: (input.cities as unknown as Database["public"]["Tables"]["profiles"]["Insert"]["cities"]) ?? undefined,
    categories: (input.categories as unknown as Database["public"]["Tables"]["profiles"]["Insert"]["categories"]) ?? undefined,
    subcategories: (input.subcategories as unknown as Database["public"]["Tables"]["profiles"]["Insert"]["subcategories"]) ?? undefined,
    last_active_at: new Date().toISOString(),
    active: true,
  } as Database["public"]["Tables"]["profiles"]["Insert"];

  // Upsert por id (RLS: id debe ser = auth.uid())
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, full_name, headline, city, categories, subcategories, years_experience, avatar_url")
    .single();

  if (error) {
    const status = /permission|rls/i.test(error.message) ? 403 : 400;
    return NextResponse.json({ ok: false, error: "UPSERT_FAILED", detail: error.message }, { status, headers: JSONH });
  }

  return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
}

export function GET() {
  return NextResponse.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: JSONH });
}
