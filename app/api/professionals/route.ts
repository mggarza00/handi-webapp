import { NextResponse } from "next/server";
// import { z } from "zod";

import { getUserOrThrow } from "@/lib/_supabase-server";
import { ProfileUpsertSchema } from "@/lib/validators/profiles";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

// GET /api/professionals?city=Monterrey&category=Plomería&page=1
export async function GET(req: Request) {
  try {
    await getUserOrThrow(); // requiere sesión
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || null;
    const category = searchParams.get("category") || null;
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = 20;
    const offset = (page - 1) * limit;

    const { supabase } = await getUserOrThrow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rpc = (supabase as any)
      .rpc("get_professionals_browse", { p_city: city, p_category: category })
      .order("is_featured", { ascending: false })
      .order("rating", { ascending: false, nullsFirst: false })
      .order("last_active_at", { ascending: false, nullsFirst: false });

    // Paginación simple en cliente si el RPC no soporta offset/limit
    rpc = rpc.range(offset, offset + limit - 1);

    const { data, error } = await rpc;
    if (error) {
      return NextResponse.json({ ok: false, error: "LIST_FAILED", detail: error.message }, { status: 400, headers: JSONH });
    }
    return NextResponse.json({ ok: true, data: data ?? [] }, { headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: 401, headers: JSONH });
  }
}

// POST /api/professionals → upsert perfil propio
export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415, headers: JSONH });
    }

    const { supabase, user } = await getUserOrThrow();
    const parsed = ProfileUpsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "VALIDATION_ERROR", detail: parsed.error.flatten() }, { status: 422, headers: JSONH });
    }

    const input = parsed.data;
    const update: Database["public"]["Tables"]["profiles"]["Update"] = {
      full_name: input.full_name ?? undefined,
      avatar_url: input.avatar_url ?? undefined,
      headline: input.headline ?? undefined,
      bio: input.bio ?? undefined,
      years_experience: input.years_experience ?? undefined,
      city: input.city ?? undefined,
      cities: input.cities ?? undefined,
      categories: input.categories ?? undefined,
      subcategories: input.subcategories ?? undefined,
      active: true,
      last_active_at: new Date().toISOString(),
    };

    // Intento de update primero
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upd, error: updErr } = await (supabase as any)
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select("id")
      .single();

    if (!upd && updErr) {
      // Intentar insert si no existe
      // Relax typing for insert to avoid friction with generated types
      const insert = {
        id: user.id,
        full_name: input.full_name ?? null,
        avatar_url: input.avatar_url ?? null,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        years_experience: input.years_experience ?? null,
        city: input.city ?? null,
        cities: input.cities ?? null,
        categories: input.categories ?? null,
        subcategories: input.subcategories ?? null,
        active: true,
        last_active_at: new Date().toISOString(),
      } as unknown as Record<string, unknown>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins, error: insErr } = await (supabase as any)
        .from("profiles")
        .insert(insert)
        .select("id")
        .single();

      if (insErr) {
        return NextResponse.json({ ok: false, error: "UPSERT_FAILED", detail: insErr.message }, { status: 400, headers: JSONH });
      }
      return NextResponse.json({ ok: true, id: ins.id }, { status: 201, headers: JSONH });
    }

    return NextResponse.json({ ok: true, id: upd?.id }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: 401, headers: JSONH });
  }
}
