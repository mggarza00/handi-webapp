type UnknownRec = Record<string, unknown>;

export type CatalogItem = {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
};

export function normalizeCatalog(input: unknown): CatalogItem[] {
  if (!Array.isArray(input)) return [];
  const out: CatalogItem[] = [];
  for (const r of input as unknown[]) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as UnknownRec;
    const id = typeof o.id === "string" ? o.id : typeof o.uuid === "string" ? o.uuid : undefined;
    const name =
      typeof o.name === "string" ? o.name :
      typeof o.title === "string" ? o.title :
      undefined;
    const category = typeof o.category === "string" ? o.category : undefined;
    const subcategory = typeof o.subcategory === "string" ? o.subcategory : undefined;
    if (id && name) out.push({ id, name, category, subcategory });
  }
  return out;
}
