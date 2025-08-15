import { NextResponse } from "next/server";
import { getUserOrThrow } from "@/lib/supabase-server";

/**
 * POST /api/professionals
 * Crea/actualiza el perfil profesional del usuario autenticado.
 * RLS: solo puedes escribir tu propio profiles.id = auth.uid().
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getUserOrThrow();
    const body = await request.json().catch(() => ({} as any));

    const patch: any = {
      id: user.id,
      role: "pro",
      full_name: typeof body.full_name === "string" ? body.full_name : null,
      headline: typeof body.headline === "string" ? body.headline : null,
      bio: typeof body.bio === "string" ? body.bio : null,
      years_experience: Number.isFinite(body?.years_experience) ? body.years_experience : null,
      city: typeof body.city === "string" ? body.city : null,
      cities: Array.isArray(body.cities) ? body.cities : undefined,
      categories: Array.isArray(body.categories) ? body.categories : undefined,
      subcategories: Array.isArray(body.subcategories) ? body.subcategories : undefined,
      active: true,
      last_active_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(patch, { onConflict: "id", ignoreDuplicates: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * GET /api/professionals
 * Devuelve TU propio perfil (RLS no permite listar otros perfiles en V1).
 */
export async function GET() {
  try {
    const { supabase, user } = await getUserOrThrow();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, profile: data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
