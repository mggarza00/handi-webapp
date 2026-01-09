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

export default function ExploreFilters({
  cities,
  categories,
  pairs,
  selected,
}: {
  cities: string[];
  categories: string[];
  pairs: Pair[];
  selected: { city: string; category: string; subcategory: string; page: string };
}) {
  const ALL = "Todas";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const city = sp?.get("city") || selected.city || ALL;
  const category = sp?.get("category") || selected.category || ALL;
  const subcategory = sp?.get("subcategory") || selected.subcategory || ALL;

  const subcategories = React.useMemo(() => {
    const cat = category && category !== ALL ? category : undefined;
    if (!cat) return [] as string[];
    const set = new Set(
      pairs
        .filter((p) => p.category === cat && p.subcategory)
        .map((p) => p.subcategory as string),
    );
    return Array.from(set).sort();
  }, [pairs, category]);

  // Ensure default params appear in URL (?page=1&city=Todas&category=Todas&subcategory=Todas)
  React.useEffect(() => {
    const base = sp?.toString() ?? "";
    const next = new URLSearchParams(base);
    let changed = false;
    if (!next.get("city")) {
      next.set("city", ALL);
      changed = true;
    }
    if (!next.get("category")) {
      next.set("category", ALL);
      changed = true;
    }
    if (!next.get("subcategory")) {
      next.set("subcategory", ALL);
      changed = true;
    }
    if (!next.get("page")) {
      next.set("page", "1");
      changed = true;
    }
    if (changed) {
      const qs = next.toString();
      router.replace(qs ? `${(pathname || "/")}?${qs}` : (pathname || "/"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushWith(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${(pathname || "/")}?${qs}` : (pathname || "/"));
  }

  function updateParams(patch: Partial<{ city: string; category: string; subcategory: string; page: string }>) {
    const base = sp?.toString() ?? "";
    const next = new URLSearchParams(base);
    const currentCity = next.get("city") || ALL;
    const currentCategory = next.get("category") || ALL;
    const currentSub = next.get("subcategory") || ALL;
    // apply patch
    const nc = patch.city ?? currentCity;
    const ncat = patch.category ?? currentCategory;
    let nsub = patch.subcategory ?? currentSub;
    // If category changed, reset subcategory to Todas
    if (patch.category !== undefined && patch.category !== currentCategory) {
      nsub = ALL;
    }
    next.set("city", nc || ALL);
    next.set("category", ncat || ALL);
    next.set("subcategory", nsub || ALL);
    next.set("page", patch.page || "1"); // reset/keep page
    pushWith(next);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Ciudad</label>
        <Select value={city} onValueChange={(val) => updateParams({ city: val, page: "1" })}>
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
        <Select value={category} onValueChange={(val) => updateParams({ category: val, page: "1" })}>
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
        <Select value={subcategory} onValueChange={(val) => updateParams({ subcategory: val, page: "1" })}>
          <SelectTrigger disabled={category === ALL || subcategories.length === 0}>
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
    </div>
  );
}
