"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Pair = { category: string; subcategory: string | null };

export default function Filters({
  cities,
  categories,
  pairs,
}: {
  cities: string[];
  categories: string[];
  pairs: Pair[];
}) {
  const ALL = "__ALL__";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const city = sp?.get("city") ?? undefined;
  const category = sp?.get("category") ?? undefined;
  const subcategory = sp?.get("subcategory") ?? undefined;

  const subcategories = React.useMemo(() => {
    if (!category) return [] as string[];
    const set = new Set(
      pairs
        .filter((p) => p.category === category && p.subcategory)
        .map((p) => p.subcategory as string),
    );
    return Array.from(set).sort();
  }, [pairs, category]);

  function pushWith(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${(pathname || "/")}?${qs}` : (pathname || "/"));
  }

  function updateParams(patch: Record<string, string | null | undefined>) {
    const base = sp?.toString() ?? "";
    const next = new URLSearchParams(base);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    pushWith(next);
  }

  function onCityChangeValue(valRaw: string) {
    const val = valRaw === ALL ? undefined : valRaw || undefined;
    updateParams({ city: val });
  }

  function onCategoryChangeValue(valRaw: string) {
    const val = valRaw === ALL ? undefined : valRaw || undefined;
    const base = sp?.toString() ?? "";
    const next = new URLSearchParams(base);
    if (val) next.set("category", val);
    else next.delete("category");

    // Reset subcategory if it no longer applies
    const nextSubs = val
      ? Array.from(
          new Set(
            pairs
              .filter((p) => p.category === val && p.subcategory)
              .map((p) => p.subcategory as string),
          ),
        )
      : [];
    const currentSub = next.get("subcategory") ?? "";
    if (!currentSub || !nextSubs.includes(currentSub)) {
      next.delete("subcategory");
    }
    pushWith(next);
  }

  function onSubcategoryChangeValue(valRaw: string) {
    const val = valRaw === ALL ? undefined : valRaw || undefined;
    updateParams({ subcategory: val });
  }

  function clearAll() {
    router.push(pathname || "/");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Ciudad</label>
        <Select value={city} onValueChange={onCityChangeValue}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Categoría</label>
        <Select value={category} onValueChange={onCategoryChangeValue}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Subcategoría</label>
        <Select value={subcategory} onValueChange={onSubcategoryChangeValue}>
          <SelectTrigger disabled={subcategories.length === 0}>
            <SelectValue placeholder="Selecciona subcategoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {subcategories.map((sc) => (
              <SelectItem key={sc} value={sc}>
                {sc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(city || category || subcategory) && (
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md border text-sm px-3 py-2 hover:bg-slate-50"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
