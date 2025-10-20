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

type Props = {
  cityOptions: string[];
  categoryOptions: string[];
  subcategoryOptions: string[];
};

export default function FiltersBar({ cityOptions, categoryOptions, subcategoryOptions }: Props) {
  const ALL = "Todas";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const city = sp?.get("city") || ALL;
  const category = sp?.get("category") || ALL;
  const subcategory = sp?.get("subcategory") || ALL;

  const onChange = (patch: Partial<{ city: string; category: string; subcategory: string }>) => {
    const base = sp?.toString() ?? "";
    const next = new URLSearchParams(base);
    if (patch.city != null) next.set("city", patch.city || ALL);
    if (patch.category != null) next.set("category", patch.category || ALL);
    if (patch.subcategory != null) next.set("subcategory", patch.subcategory || ALL);
    // Reset page to 1 on filter change
    next.set("page", "1");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname || "/");
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Ciudad</label>
        <Select value={city} onValueChange={(v) => onChange({ city: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona ciudad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {cityOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Categoría</label>
        <Select value={category} onValueChange={(v) => onChange({ category: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-600 mb-1">Subcategoría</label>
        <Select value={subcategory} onValueChange={(v) => onChange({ subcategory: v })}>
          <SelectTrigger disabled={subcategoryOptions.length === 0}>
            <SelectValue placeholder="Selecciona subcategoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {subcategoryOptions.map((sc) => (
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

