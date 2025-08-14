import { NextResponse } from "next/server";
import { supabaseServer, getUserOrThrow } from "@/lib/supabase-server";

export async function GET() {
  try {
    const user = await getUserOrThrow();
    const supabase = supabaseServer();

    // 1) Encontrar el professional del usuario
    const { data: pro, error: proErr } = await supabase
      .from("professionals")
      .select("id, is_active")
      .eq("profile_id", user.id)
      .single();

    if (proErr || !pro) return NextResponse.json({ ok: false, error: "NO_PROFESSIONAL_PROFILE" }, { status: 404 });
    if (pro.is_active === false) return NextResponse.json({ ok: true, data: [] });

    // 2) Categorías del profesional
    const { data: cats, error: catErr } = await supabase
      .from("professional_categories")
      .select("category, subcategory")
      .eq("professional_id", pro.id);

    if (catErr) return NextResponse.json({ ok: false, error: catErr.message }, { status: 400 });
    if (!cats || cats.length === 0) return NextResponse.json({ ok: true, data: [] });

    const pairs = cats.map(c => [c.category, c.subcategory] as [string,string]);

    // 3) Requests que matchean (estado active) por categoría/subcategoría
    // Nota: si usas múltiples subcategorías por request, aquí puedes ajustar a ANY(...) según tu modelo.
    let query = supabase
      .from("requests")
      .select("*")
      .eq("status", "active");

    // filtrar por pares
    // como sólo tenemos category/subcategory simples, hacemos OR manual básico:
    // (si tuvieras arrays en requests, usarías overlaps)
    const { data: reqs, error: reqErr } = await query;
    if (reqErr) return NextResponse.json({ ok: false, error: reqErr.message }, { status: 400 });

    const set = new Set(reqs?.filter(r =>
      pairs.some(([cat, sub]) => r.category === cat && r.subcategory === sub)
    ));

    // TODO: filtro por ciudad cuando tengamos cities de servicio del pro
    const list = Array.from(set).sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ ok: true, data: list });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "INTERNAL_ERROR" }, { status: 500 });
  }
}
