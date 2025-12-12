"use client";

import * as React from "react";

import Filters from "./Filters.client";

import { Input } from "@/components/ui/input";
import ProfessionalsGrid from "@/components/professionals/ProfessionalsGrid.client";

type Pair = { category: string; subcategory: string | null };

type Pro = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  rating: number | null;
  categories?: unknown;
  subcategories?: unknown;
  city?: string | null;
  years_experience?: number | null;
  jobsDone?: number | null;
};

function includesQuery(value: unknown, q: string): boolean {
  if (!q) return true;
  const str =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value
            .map((v) =>
              v && typeof v === "object"
                ? ((v as Record<string, unknown>).name ?? "")
                : String(v ?? ""),
            )
            .join(" ")
        : "";
  return str.toLowerCase().includes(q);
}

export default function ProfessionalsFiltersAndGrid({
  cities,
  categories,
  pairs,
  items,
}: {
  cities: string[];
  categories: string[];
  pairs: Pair[];
  items: Pro[];
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!q) return items;
    return items.filter((p) => {
      return (
        includesQuery(p.full_name, q) ||
        includesQuery(p.headline, q) ||
        includesQuery(p.bio, q) ||
        includesQuery(p.city, q) ||
        includesQuery(p.categories, q) ||
        includesQuery(p.subcategories, q)
      );
    });
  }, [items, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Filters cities={cities} categories={categories} pairs={pairs} />
        <div className="ml-auto w-full max-w-xs">
          <label className="mb-1 block text-xs text-slate-600">Buscar</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca por nombre, categoría o ciudad"
            className="h-10"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-slate-600">
          No hay profesionales disponibles.
        </div>
      ) : (
        <>
          <div className="mt-2 text-xs text-slate-500">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="mt-10">
            <ProfessionalsGrid items={filtered} />
          </div>
        </>
      )}
    </div>
  );
}
