import { supabaseClient } from "@/lib/supabase-client";

export type CategoryOption = { value: string; subs: string[] };

/**
 * Lee categorías/subcategorías de Supabase.
 * Soporta dos nombres de tabla:
 *   - catalog_categories (recomendada) con columnas: category (text), subcategory (text), active (bool)
 *   - categories_subcategories (alternativa) con mismas columnas
 */
export async function loadCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = supabaseClient();

  // Helper que consulta una tabla dada y regresa pares {category, subcategory}
  async function tryTable(table: string) {
    const { data, error } = await supabase
      .from(table)
      .select("category, subcategory, active")
      .order("category", { ascending: true });
    if (error) throw error;
    // Si hay columna active, filtra; si no, pasa.
    const rows = (data ?? []).filter((r: any) => r.active ?? true);
    return rows.map((r: any) => ({ category: String(r.category || "").trim(), subcategory: String(r.subcategory || "").trim() }))
               .filter((r: any) => r.category && r.subcategory);
  }

  // Intenta en orden
  let rows: { category: string; subcategory: string }[] = [];
  let lastErr: any = null;

  for (const tbl of ["catalog_categories", "categories_subcategories"]) {
    try {
      rows = await tryTable(tbl);
      if (rows.length) break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!rows.length && lastErr) {
    // Re-lanza el último error si no hubo filas en ninguna tabla
    throw lastErr;
  }

  // Agrupar
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!map.has(r.category)) map.set(r.category, new Set());
    map.get(r.category)!.add(r.subcategory);
  }

  // Ordenar alfabéticamente (UX)
  const categories = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "es"));
  return categories.map((c) => ({
    value: c,
    subs: Array.from(map.get(c)!).sort((a, b) => a.localeCompare(b, "es")),
  }));
}
