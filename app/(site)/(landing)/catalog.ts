export type CategoryCard = {
  name: string;
  color: string | null;
  image: string | null;
};

export type Subcat = {
  name: string;
  icon: string | null;
  color: string | null;
  iconUrl: string | null;
};

export type CatalogRow = {
  category?: string | null;
  subcategory?: string | null;
  icon?: string | null;
  iconUrl?: string | null;
  image?: string | null;
  color?: string | null;
};

export type CatalogLists = {
  categoryCards: CategoryCard[];
  subcategories: Subcat[];
};

const toCleanString = (value: unknown) => (value ?? "").toString().trim();

const localeSort = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "base" });

export const normalizeMediaUrl = (value: string | null | undefined) => {
  const raw = toCleanString(value);
  if (!raw) return null;
  const s = raw
    .replace(/^["']+|["']+$/g, "")
    .replace(/\\/g, "/")
    .trim();
  if (!s) return null;
  // paths absolutos locales: recorta hasta /public/ si existe
  const lower = s.toLowerCase();
  const publicIdx = lower.indexOf("/public/");
  if (publicIdx >= 0) {
    const tail = s.slice(publicIdx + "/public".length);
    return tail.startsWith("/") ? tail : `/${tail}`;
  }
  // Si viene con drive (C:/...) sin /public/, intenta detectar carpeta images/categorias
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
  // rutas relativas dentro de public (ej: images/categorias/archivo.jpg)
  if (lower.startsWith("images/")) return `/${s}`;
  return `/${s.replace(/^\/+/, "")}`;
};

export const buildCatalogLists = (rows: CatalogRow[]): CatalogLists => {
  const catMeta = new Map<
    string,
    { color: string | null; image: string | null }
  >();
  const subMap = new Map<string, Subcat>();

  (rows || []).forEach((row) => {
    const categoryName = toCleanString(row.category);
    const subName = toCleanString(row.subcategory);
    const icon = toCleanString(row.icon) || null;
    const iconUrl = normalizeMediaUrl(row.iconUrl);
    const image = normalizeMediaUrl(row.image);
    const color = toCleanString(row.color) || null;

    if (categoryName.length > 0) {
      const existing = catMeta.get(categoryName) || {
        color: null,
        image: null,
      };
      catMeta.set(categoryName, {
        color: existing.color || color || null,
        image: existing.image || image || null,
      });
    }

    if (subName.length > 0 && !subMap.has(subName)) {
      subMap.set(subName, {
        name: subName,
        icon,
        iconUrl,
        color,
      });
    }
  });

  return {
    categoryCards: Array.from(catMeta.entries())
      .map(([name, meta]) => ({
        name,
        color: meta.color,
        image: meta.image,
      }))
      .sort((a, b) => localeSort(a.name, b.name)),
    subcategories: Array.from(subMap.values()).sort((a, b) =>
      localeSort(a.name, b.name),
    ),
  };
};
