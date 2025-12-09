import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";
import { createServerClient as createServiceClient } from "@/lib/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const clientId = auth?.user?.id ?? null;
    const { searchParams } = new URL(req.url);
    const proId = (searchParams.get('proId') || '').trim() || null;

    if (!clientId) {
      if (proId) return NextResponse.json({ ok: true, is_favorite: false }, { status: 200, headers: JSONH });
      return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });
    }

    // 1) Obtener favoritos del cliente (modo lista o estado)
    if (proId) {
      const chk = await supabase
        .from('client_favorites')
        .select('pro_id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('pro_id', proId);
      if (chk.error) {
        const msg = (chk.error.message || '').toLowerCase();
        const missing = /not exist|not found|schema cache|relation .* does not exist/.test(msg);
        if (missing) {
          return NextResponse.json({ ok: true, is_favorite: false, meta: { hint: 'MIGRATION_REQUIRED: client_favorites' } }, { status: 200, headers: JSONH });
        }
        return NextResponse.json({ error: chk.error.message }, { status: 400, headers: JSONH });
      }
      const is_favorite = (chk.count ?? 0) > 0;
      return NextResponse.json({ ok: true, is_favorite }, { status: 200, headers: JSONH });
    }

    const fav = await supabase
      .from('client_favorites')
      .select('pro_id')
      .eq('client_id', clientId);
    if (fav.error) {
      const msg = (fav.error.message || '').toLowerCase();
      const missing = /not exist|not found|schema cache|relation .* does not exist/.test(msg);
      if (missing) {
        // Si la tabla no existe aún (migración no aplicada), responde vacío sin fallar
        return NextResponse.json({ ok: true, data: [], meta: { hint: 'MIGRATION_REQUIRED: client_favorites' } }, { status: 200, headers: JSONH });
      }
      return NextResponse.json({ error: fav.error.message }, { status: 400, headers: JSONH });
    }
    const proIds = Array.from(new Set((fav.data ?? []).map((r) => String((r as any).pro_id)))) as string[];
    if (proIds.length === 0) return NextResponse.json({ ok: true, data: [] }, { status: 200, headers: JSONH });

    // 2) Cargar información básica de profesionales
    // Usar SERVICE ROLE para información pública de profesionales (evita fricciones de RLS)
    const admin = createServiceClient();
    const pros = await admin
      .from("professionals")
      .select("id, full_name, avatar_url, city, categories, subcategories, years_experience")
      .in("id", proIds);
    if (pros.error) return NextResponse.json({ error: pros.error.message }, { status: 400, headers: JSONH });

    const data = (pros.data ?? []).map((p) => ({
      id: (p as any).id as string,
      name: ((p as any).full_name as string | null) || "Profesional",
      avatar_url: ((p as any).avatar_url as string | null) || null,
      city: ((p as any).city as string | null) || null,
      categories: ((p as any).categories as unknown) ?? null,
      subcategories: ((p as any).subcategories as unknown) ?? null,
      years_experience: typeof (p as any).years_experience === 'number' ? (p as any).years_experience : null,
    }));

    return NextResponse.json({ ok: true, data }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ error: msg }, { status: 500, headers: JSONH });
  }
}
