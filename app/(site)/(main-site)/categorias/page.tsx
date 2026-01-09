import Link from "next/link";
import { headers } from "next/headers";

import CategoriesGrid from "./CategoriesGrid.client";
import type { CategoryCard } from "./types";

import createClient from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type CatalogRow = {
  category?: string | null;
  subcategory?: string | null;
  icon?: string | null;
  iconUrl?: string | null;
  image?: string | null;
  color?: string | null;
};

const toCleanString = (value: unknown) => (value ?? "").toString().trim();
const localeSort = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base" });
const normalizeMediaUrl = (value: string | null | undefined) => {
  const raw = toCleanString(value);
  if (!raw) return null;
  const s = raw
    .replace(/^["']+|["']+$/g, "")
    .replace(/\\/g, "/")
    .trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  const publicIdx = lower.indexOf("/public/");
  if (publicIdx >= 0) {
    const tail = s.slice(publicIdx + "/public".length);
    return tail.startsWith("/") ? tail : `/${tail}`;
  }
  if (
    /^[a-zA-Z]:\//.test(s) ||
    (s.startsWith("/") && /^[a-zA-Z]:\//.test(s.slice(1)))
  ) {
    const imagesIdx = lower.indexOf("/images/");
    const iconsIdx = lower.indexOf("/icons/");
    const idx = imagesIdx >= 0 ? imagesIdx : iconsIdx;
    if (idx >= 0) {
      const tail = s.slice(idx);
      return tail.startsWith("/") ? tail : `/${tail}`;
    }
    return null;
  }
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return s;
  if (s.includes("://")) return null;
  if (lower.startsWith("images/")) return `/${s}`;
  return `/${s.replace(/^\/+/, "")}`;
};

const isActive = (value: unknown) => {
  const normalized = toCleanString(value).toLowerCase();
  return (
    normalized === "sí" ||
    normalized === "si" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "activo" ||
    normalized === "activa" ||
    normalized === "x"
  );
};

const buildCategoryCards = (rows: CatalogRow[]): CategoryCard[] => {
  const catMap = new Map<
    string,
    {
      color: string | null;
      image: string | null;
      subcategories: Map<
        string,
        { name: string; icon: string | null; iconUrl: string | null }
      >;
    }
  >();

  (rows || []).forEach((row) => {
    const categoryName = toCleanString(row.category);
    if (!categoryName) return;

    const subName = toCleanString(row.subcategory);
    const icon = toCleanString(row.icon) || null;
    const iconUrl = icon ? null : normalizeMediaUrl(row.iconUrl);
    const image = normalizeMediaUrl(row.image);
    const color = toCleanString(row.color) || null;

    const existing = catMap.get(categoryName) || {
      color: null,
      image: null,
      subcategories: new Map<
        string,
        { name: string; icon: string | null; iconUrl: string | null }
      >(),
    };

    existing.color = existing.color || color || null;
    existing.image = existing.image || image || null;

    if (subName) {
      const key = subName.toLowerCase();
      if (!existing.subcategories.has(key)) {
        existing.subcategories.set(key, { name: subName, icon, iconUrl });
      }
    }

    catMap.set(categoryName, existing);
  });

  return Array.from(catMap.entries())
    .map(([name, meta]) => ({
      name,
      color: meta.color,
      image: meta.image,
      subcategories: Array.from(meta.subcategories.values()).sort((a, b) =>
        localeSort(a.name, b.name),
      ),
    }))
    .sort((a, b) => {
      const diff = b.subcategories.length - a.subcategories.length;
      if (diff !== 0) return diff;
      return localeSort(a.name, b.name);
    });
};

const fetchCatalogViaApi = async (): Promise<CategoryCard[]> => {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  const response = await fetch(`${base}/api/catalog/categories`, {
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.detail || payload?.error || "fetch_failed");
  }
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return buildCategoryCards(rows as CatalogRow[]);
};

const fetchCatalogFromSupabase = async (): Promise<CategoryCard[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories_subcategories")
    .select("*");
  if (error) throw error;
  const pick = (rec: Record<string, unknown>, keys: string[]) => {
    for (const k of keys) {
      const val = rec?.[k];
      if (val !== undefined && val !== null && toCleanString(val).length > 0) {
        return toCleanString(val);
      }
    }
    return null;
  };
  const rows: CatalogRow[] = (data || [])
    .filter((row: Record<string, unknown>) => isActive(row?.["Activa"]))
    .map((row: Record<string, unknown>) => ({
      category: toCleanString(row?.["Categoría"]),
      subcategory: toCleanString(row?.["Subcategoría"]),
      icon: toCleanString(row?.["Emoji"]) || null,
      // Usamos únicamente los emojis para las subcategorías al venir de Supabase.
      iconUrl: null,
      image: pick(row, ["imagen", "image"]),
      color: pick(row, ["color"]),
    }));
  return buildCategoryCards(rows);
};

export default async function CategoriasPage() {
  let categoryCards: CategoryCard[] = [];
  let loadError: string | null = null;

  try {
    categoryCards = await fetchCatalogViaApi();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "api_error";
    try {
      categoryCards = await fetchCatalogFromSupabase();
    } catch (fallbackError) {
      if (fallbackError instanceof Error) {
        loadError = `${loadError ?? ""} ${fallbackError.message}`.trim();
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      <section className="border-b border-slate-200 bg-[#F5F7FA]">
        <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-[#082877]">
              Categorías
            </h1>
            <p className="text-sm text-slate-700">
              Explora las categorías y subcategorías disponibles en Handi.
            </p>
          </div>

          {loadError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
              No fue posible cargar el catálogo desde la API. Mostrando datos
              disponibles.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CategoriesGrid cards={categoryCards} />
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-700 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-base font-semibold text-[#082877]">
                ¿No encuentras lo que buscas?
              </p>
              <p className="text-sm text-slate-600">
                Si no ves el servicio que ofreces en nuestras categorias,
                mándanos un correo con la información de tu servicio y con gusto
                te ayudamos.
              </p>
            </div>
            <Link
              className="inline-flex rounded-full bg-[#082877] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#051a55]"
              href="mailto:Soporte@handi.mx"
            >
              Mandar info
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
