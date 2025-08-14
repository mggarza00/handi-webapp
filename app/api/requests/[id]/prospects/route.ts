import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const supabase = supabaseServer();
  const requestId = ctx.params.id;

  // 1) Traer request
  const { data: reqRow, error: reqErr } = await supabase
    .from("requests")
    .select("id, category, subcategory, city")
    .eq("id", requestId)
    .single();

  if (reqErr || !reqRow) {
    return NextResponse.json({ ok: false, error: reqErr?.message || "REQUEST_NOT_FOUND" }, { status: 404 });
  }

  // 2) Buscar profesionales que coincidan por categoría/subcategoría
  const { data: rows, error: proErr } = await supabase
    .from("professional_categories")
    .select(`
      professional:professional_id (
        id, headline, rating, is_featured, is_active, skills, created_at
      ),
      category, subcategory
    `)
    .eq("category", reqRow.category)
    .eq("subcategory", reqRow.subcategory);

  if (proErr) return NextResponse.json({ ok: false, error: proErr.message }, { status: 400 });

  const map = new Map<string, any>();
  for (const r of rows ?? []) {
    const p = (r as any).professional as any;
    if (!p || (p as any).is_active === false) continue;
    if (!map.has((p as any).id)) map.set((p as any).id, { ...p, categories: new Set<string>() });
    (map.get((p as any).id) as any).categories.add(`${r.category}/${r.subcategory}`);
  }

  const list = Array.from(map.values()).map((p: any) => ({
    id: p.id,
    headline: p.headline,
    rating: p.rating,
    is_featured: p.is_featured,
    is_active: (p as any).is_active,
    skills: p.skills,
    categories: Array.from(p.categories),
    created_at: p.created_at,
  }));

  // Orden: featured -> rating desc -> (cercanía placeholder) -> recencia
  list.sort((a: any, b: any) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Limitar a top 20
  const top = list.slice(0, 20);

  return NextResponse.json({ ok: true, data: top });
}
