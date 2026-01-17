import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

import type { Database } from "@/types/supabase";
import { ProfileUpsertSchema } from "@/lib/validators/profiles";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
      { status: 415, headers: JSONH },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHENTICATED" },
      { status: 401, headers: JSONH },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON" },
      { status: 400, headers: JSONH },
    );
  }

  const parsed = ProfileUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() },
      { status: 422, headers: JSONH },
    );
  }

  const input = parsed.data;

  // Comprobar si ya existe el profesional para no desactivar a aprobados
  const { data: existing } = await (supabase as any)
    .from("professionals")
    .select("id, active")
    .eq("id", user.id)
    .maybeSingle();

  const payload: Database["public"]["Tables"]["professionals"]["Insert"] = {
    id: user.id,
    full_name: input.full_name ?? null,
    avatar_url: input.avatar_url ?? null,
    headline: input.headline ?? null,
    bio: input.bio ?? null,
    years_experience: input.years_experience ?? null,
    // empresa -> boolean flag stored on professionals
    empresa: input.empresa ?? null,
    city: input.city ?? null,
    cities:
      (input.cities as unknown as Database["public"]["Tables"]["professionals"]["Insert"]["cities"]) ??
      undefined,
    categories:
      (input.categories as unknown as Database["public"]["Tables"]["professionals"]["Insert"]["categories"]) ??
      undefined,
    subcategories:
      (input.subcategories as unknown as Database["public"]["Tables"]["professionals"]["Insert"]["subcategories"]) ??
      undefined,
    last_active_at: new Date().toISOString(),
    // Si NO existe fila previa, inicializar como inactivo; si ya existe, no tocar 'active'
    ...(existing?.id ? {} : { active: false }),
  } as Database["public"]["Tables"]["professionals"]["Insert"];
  // No elevar rol aqui; el alta de profesional se controla por aprobacion/admin.

  // Upsert por id (RLS: id debe ser = auth.uid()) en professionals
  const { data, error } = await (supabase as any)
    .from("professionals")
    .upsert(payload, { onConflict: "id" })
    .select(
      "id, full_name, headline, city, categories, subcategories, years_experience, avatar_url",
    )
    .single();

  if (error) {
    const status = /permission|rls/i.test(error.message) ? 403 : 400;
    return NextResponse.json(
      { ok: false, error: "UPSERT_FAILED", detail: error.message },
      { status, headers: JSONH },
    );
  }

  // Mantener sincronizado el nombre visible del perfil base
  try {
    if (
      typeof input.full_name === "string" &&
      input.full_name.trim().length >= 2
    ) {
      await (supabase as any)
        .from("profiles")
        .update({ full_name: input.full_name.trim() })
        .eq("id", user.id);
    }
  } catch {
    // ignorar errores de sincronización de nombre
  }

  return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
}

export function GET() {
  return NextResponse.json(
    { ok: false, error: "METHOD_NOT_ALLOWED" },
    { status: 405, headers: JSONH },
  );
}
