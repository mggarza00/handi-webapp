import Link from "next/link";
import { headers } from "next/headers";
import Image from "next/image";

import createClient from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Subcategory = { name: string; icon: string | null };
type Category = { name: string; subcategories: Subcategory[] };

function isActive(v: unknown): boolean {
  const s = (v ?? "").toString().trim().toLowerCase();
  return s === "sí" || s === "si" || s === "true" || s === "1" || s === "activo" || s === "activa" || s === "x";
}

function isImg(icon: string | null): boolean {
  if (!icon) return false;
  const s = icon.toString();
  return /^https?:\/\//.test(s) || s.startsWith("/") || /\.(png|jpe?g|gif|svg)$/i.test(s);
}

export default async function CategoriasPage() {
  // 1) Intentar vía API interna (usa service role en el servidor)
  let normalized: Array<{ category: string; subcategory: string; icon: string | null }> = [];
  let loadError: string | null = null;
  try {
    const h = headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const base = `${proto}://${host}`;
    const r = await fetch(`${base}/api/catalog/categories`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j?.ok === false) throw new Error(j?.detail || j?.error || "fetch_failed");
    const rows: Array<{ category?: string | null; subcategory?: string | null; icon?: string | null }>
      = Array.isArray(j?.data) ? j.data : [];
    normalized = rows
      .map((x) => ({
        category: (x?.category ?? "").toString().trim(),
        subcategory: (x?.subcategory ?? "").toString().trim(),
        icon: ((x?.icon ?? "").toString().trim() || null) as string | null,
      }))
      .filter((r) => r.category.length > 0 && r.subcategory.length > 0);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "api_error";
    // 2) Fallback directo a Supabase público (RLS puede filtrar)
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories_subcategories")
        .select('"Categoría","Subcategoría","Activa","Ícono"');
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
      normalized = rows
        .filter((r) => isActive(r["Activa"]))
        .map((r) => ({
          category: (r["Categoría"] ?? "").toString().trim(),
          subcategory: (r["Subcategoría"] ?? "").toString().trim(),
          icon: ((r["Ícono"] ?? "").toString().trim() || null) as string | null,
        }))
        .filter((r) => r.category.length > 0 && r.subcategory.length > 0);
    } catch {
      // keep empty
    }
  }

  // Agrupar por categoría y ordenar
  const map = new Map<string, Subcategory[]>();
  for (const r of normalized) {
    if (!map.has(r.category)) map.set(r.category, []);
    const list = map.get(r.category)!;
    if (!list.some((x) => x.name.toLowerCase() === r.subcategory.toLowerCase())) {
      list.push({ name: r.subcategory, icon: r.icon });
    }
  }

  const categories: Category[] = Array.from(map.entries())
    // Ordenar: más subcategorías primero; empate por nombre A-Z
    .sort((a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]))
    .map(([name, subs]) => ({ name, subcategories: subs.sort((a, b) => a.name.localeCompare(b.name)) }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Categorías y subcategorías</h1>
      <p className="mt-1 text-sm text-slate-600">Explora las categorías y subcategorías disponibles en Handi.</p>

      {loadError ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          No fue posible cargar el catálogo.
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {categories.map((cat) => (
          <div key={cat.name} className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-medium">{cat.name}</h2>
            {cat.subcategories.length > 0 ? (
              <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-700">
                {cat.subcategories.map((sc) => (
                  <li key={sc.name} className="flex items-center gap-2">
                    {sc.icon ? (
                      isImg(sc.icon) ? (
                        <Image
                          src={sc.icon}
                          alt=""
                          width={16}
                          height={16}
                          unoptimized
                          className="h-4 w-4 object-contain"
                        />
                      ) : (
                        <span aria-hidden className="text-base leading-none">{sc.icon}</span>
                      )
                    ) : null}
                    <span>{sc.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {categories.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
            No hay categorías activas disponibles.
          </div>
        ) : null}
      </div>

      <div className="mt-8 text-sm text-slate-600">
        ¿No encuentras lo que buscas? <Link className="underline" href="/search">Busca profesionales</Link> o <Link className="underline" href="/pro-apply">ofrece tus servicios</Link>.
      </div>
    </div>
  );
}
