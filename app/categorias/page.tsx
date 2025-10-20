import Link from "next/link";

import { getAdminSupabase } from "@/lib/supabase/admin";
import localCatalog from "@/data/categories.json";

export const dynamic = "force-dynamic";

type Row = {
  category: string;
  subcategory: string;
  icon: string | null;
};

function isActive(v: unknown) {
  const s = (v ?? "").toString().trim().toLowerCase();
  return (
    s === "sí" ||
    s === "si" ||
    s === "true" ||
    s === "1" ||
    s === "activo" ||
    s === "activa" ||
    s === "x"
  );
}

function isUrl(s: string | null): s is string {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function getRows(): Promise<Row[]> {
  // 1) Try Supabase (admin) for live data
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("categories_subcategories")
      .select('"Categoría","Subcategoría","Activa","Ícono"');
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : [])
      .filter((r) => isActive((r as Record<string, unknown>)["Activa"]))
      .map((r) => {
        const rec = r as Record<string, unknown>;
        return {
          category: String(rec["Categoría"] ?? "").trim(),
          subcategory: String(rec["Subcategoría"] ?? "").trim(),
          icon: (String(rec["Ícono"] ?? "").trim() || null) as string | null,
        } satisfies Row;
      })
      .filter((r) => r.category && r.subcategory);
    if (rows.length) return rows;
  } catch {
    // continue to fallback
  }

  // 2) Fallback to local JSON file
  try {
    const rows: Row[] = [];
    const cats = (localCatalog as unknown as Array<{
      id: string;
      name: string;
      subcategories: Array<{ id: string; name: string; icon?: string | null }>;
    }>);
    for (const c of cats) {
      for (const s of c.subcategories || []) {
        if (!s?.name) continue;
        rows.push({ category: c.name, subcategory: s.name, icon: s.icon ?? null });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export default async function CategoriasPage() {
  const rows = await getRows();
  // Group by category
  const grouped = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.category.trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }
  // Sort categories and subcategories
  const categories = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "es"));
  categories.forEach((c) => grouped.get(c)!.sort((a, b) => a.subcategory.localeCompare(b.subcategory, "es")));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <nav className="mb-3 text-sm text-slate-600" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-slate-900">Inicio</Link>
              </li>
              <li aria-hidden className="text-slate-400">/</li>
              <li className="text-slate-900">Categorías</li>
            </ol>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías y subcategorías</h1>
          <p className="mt-1 text-sm text-slate-600">Consulta en qué categoría se encuentra cada subcategoría.</p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Subcategoría</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const subs = grouped.get(cat)!;
                  return subs.map((row, idx) => (
                    <tr key={`${cat}-${row.subcategory}`} className="border-t border-slate-200">
                      {idx === 0 ? (
                        <td className="px-4 py-3 align-top font-medium text-slate-900" rowSpan={subs.length}>
                          {cat}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 align-top text-slate-800">
                        <span className="inline-flex items-center gap-2">
                          {row.icon ? (
                            isUrl(row.icon) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={row.icon} alt="" className="h-4 w-4 object-contain" />
                            ) : (
                              <span className="text-sm leading-none">{row.icon}</span>
                            )
                          ) : null}
                          <span>{row.subcategory}</span>
                        </span>
                      </td>
                    </tr>
                  ));
                })}
                {categories.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={2}>
                      No hay categorías disponibles. Verifica tu conexión o configuración.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Fuente: catálogo interno de Handi. Si notas un error en la clasificación o un ícono faltante, contáctanos.
          </p>
        </div>
      </section>

      
    </main>
  );
}
