// lib/professionals/filter.ts
export type ProfessionalRow = Record<string, unknown>;

export function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed as unknown[];
      } catch {
        /* ignore parse errors */
      }
    }
    if (s.includes(",")) {
      return s
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
    }
    return s ? [s] : [];
  }
  return [];
}

export function toNames(v: unknown): string[] {
  const arr = toArray(v);
  return arr
    .map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object"
          ? (x as Record<string, unknown>).name
          : null,
    )
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => s.trim());
}

export const toNorm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export type ProfessionalFilterOptions = {
  city?: string | null;
  category?: string | null;
  subcategory?: string | null;
  includeIncomplete?: boolean;
};

export function filterProfessionalsByRequest(
  rows: unknown[],
  opts: ProfessionalFilterOptions,
): ProfessionalRow[] {
  const list = (Array.isArray(rows) ? rows : []) as ProfessionalRow[];
  const includeIncomplete = opts.includeIncomplete ?? false;
  const normCity = opts.city ? toNorm(opts.city) : null;
  const normCategory = opts.category ? toNorm(opts.category) : null;
  const normSub = opts.subcategory ? toNorm(opts.subcategory) : null;

  return list
    .filter((r) => {
      if (r.active === false) return false;

      if (!includeIncomplete) {
        const name = typeof r.full_name === "string" ? r.full_name.trim() : "";
        if (!name) return false;
      }

      if (normCity) {
        const cNorm = toNorm(r.city);
        const citiesArrNorm = toNames(r.cities).map(toNorm);
        const cityOk =
          cNorm === normCity ||
          citiesArrNorm.includes(normCity) ||
          (cNorm && cNorm.includes(normCity));
        if (!cityOk) return false;
      }

      if (normCategory) {
        const catsNorm = toNames(r.categories).map(toNorm);
        if (!catsNorm.includes(normCategory)) return false;
      }

      if (normSub) {
        const subsNorm = toNames(r.subcategories).map(toNorm);
        if (!subsNorm.includes(normSub)) return false;
      }

      return true;
    })
    .sort((aa, bb) => {
      const f1 = aa.is_featured ? 1 : 0;
      const f2 = bb.is_featured ? 1 : 0;
      if (f1 !== f2) return f2 - f1;
      const r1 = typeof aa.rating === "number" ? (aa.rating as number) : -1;
      const r2 = typeof bb.rating === "number" ? (bb.rating as number) : -1;
      if (r1 !== r2) return r2 - r1;
      const d1 = aa.last_active_at ? Date.parse(String(aa.last_active_at)) : 0;
      const d2 = bb.last_active_at ? Date.parse(String(bb.last_active_at)) : 0;
      return d2 - d1;
    });
}
