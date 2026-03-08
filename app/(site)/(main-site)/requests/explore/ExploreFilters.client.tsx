"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Pair = { category: string; subcategory: string | null };
type SortValue = "recent" | "budget_desc" | "category_asc";

type Option = { value: string; label: string };

const DEFAULT_SORT: SortValue = "recent";

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "recent", label: "Mas recientes" },
  { value: "budget_desc", label: "Mayor presupuesto" },
  { value: "category_asc", label: "Categoria A-Z" },
];

function isSortValue(value: string): value is SortValue {
  return (
    value === "recent" || value === "budget_desc" || value === "category_asc"
  );
}

function parseCsv(value?: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

function toCsv(values: string[]): string {
  return values.join(",");
}

function summaryLabel(
  values: string[],
  allLabel: string,
  manyLabel: string,
): string {
  if (values.length === 0) return allLabel;
  if (values.length === 1) return values[0];
  return `${values.length} ${manyLabel}`;
}

function MultiFilterSelect({
  label,
  options,
  selected,
  onChange,
  allLabel,
  manyLabel,
  disabled,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  manyLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(Array.from(next));
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-lg whitespace-normal text-left h-auto"
            disabled={disabled}
          >
            <span className="flex-1 min-w-0 break-words">
              {summaryLabel(selected, allLabel, manyLabel)}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => onChange([])}
                  className="cursor-pointer"
                >
                  <Check
                    className={
                      selected.length === 0
                        ? "mr-2 h-4 w-4 opacity-100"
                        : "mr-2 h-4 w-4 opacity-0"
                    }
                  />
                  {allLabel}
                </CommandItem>
                {options.map((opt) => {
                  const isSelected = selectedSet.has(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => toggle(opt.value)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={
                          isSelected
                            ? "mr-2 h-4 w-4 opacity-100"
                            : "mr-2 h-4 w-4 opacity-0"
                        }
                      />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OrderSelect({
  value,
  onChange,
}: {
  value: SortValue;
  onChange: (value: SortValue) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected =
    SORT_OPTIONS.find((opt) => opt.value === value) ?? SORT_OPTIONS[0];

  return (
    <div className="space-y-1.5">
      <Label>Ordenar</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-lg whitespace-normal text-left h-auto"
          >
            <span className="flex-1 min-w-0 break-words">{selected.label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => onChange(opt.value)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={
                          isSelected
                            ? "mr-2 h-4 w-4 opacity-100"
                            : "mr-2 h-4 w-4 opacity-0"
                        }
                      />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ExploreFilters({
  cities,
  categories,
  pairs,
  selected,
}: {
  cities: string[];
  categories: string[];
  pairs: Pair[];
  selected: {
    city: string;
    category: string;
    subcategory: string;
    sort: string;
    page: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [cityValues, setCityValues] = React.useState<string[]>(() =>
    parseCsv(sp?.get("city") ?? selected.city),
  );
  const [categoryValues, setCategoryValues] = React.useState<string[]>(() =>
    parseCsv(sp?.get("category") ?? selected.category),
  );
  const [subcategoryValues, setSubcategoryValues] = React.useState<string[]>(
    () => parseCsv(sp?.get("subcategory") ?? selected.subcategory),
  );
  const [sort, setSort] = React.useState<SortValue>(() => {
    const raw = (sp?.get("sort") ?? selected.sort ?? DEFAULT_SORT).trim();
    return isSortValue(raw) ? raw : DEFAULT_SORT;
  });

  // Keep local state aligned when URL changes externally (back/forward, SSR nav).
  React.useEffect(() => {
    setCityValues(parseCsv(sp?.get("city") ?? selected.city));
    setCategoryValues(parseCsv(sp?.get("category") ?? selected.category));
    setSubcategoryValues(
      parseCsv(sp?.get("subcategory") ?? selected.subcategory),
    );
    const raw = (sp?.get("sort") ?? selected.sort ?? DEFAULT_SORT).trim();
    setSort(isSortValue(raw) ? raw : DEFAULT_SORT);
  }, [
    sp,
    selected.city,
    selected.category,
    selected.subcategory,
    selected.sort,
  ]);

  const cityOptions = React.useMemo<Option[]>(
    () => cities.map((c) => ({ value: c, label: c })),
    [cities],
  );

  const categoryOptions = React.useMemo<Option[]>(
    () => Array.from(new Set(categories)).map((c) => ({ value: c, label: c })),
    [categories],
  );

  const availableSubcategories = React.useMemo(() => {
    const selectedCategories = new Set(categoryValues);
    const fromPairs = pairs.filter((p) => {
      if (!p.subcategory) return false;
      if (selectedCategories.size === 0) return true;
      return selectedCategories.has(p.category);
    });
    return Array.from(
      new Set(fromPairs.map((p) => p.subcategory as string)),
    ).sort();
  }, [pairs, categoryValues]);

  const subcategoryOptions = React.useMemo<Option[]>(
    () => availableSubcategories.map((s) => ({ value: s, label: s })),
    [availableSubcategories],
  );

  const validSubcategorySet = React.useMemo(
    () => new Set(availableSubcategories),
    [availableSubcategories],
  );

  React.useEffect(() => {
    const invalid = subcategoryValues.filter(
      (s) => !validSubcategorySet.has(s),
    );
    if (invalid.length === 0) return;

    const next = new URLSearchParams(sp?.toString() ?? "");
    const cleaned = subcategoryValues.filter((s) => validSubcategorySet.has(s));
    setSubcategoryValues(cleaned);
    if (cleaned.length > 0) next.set("subcategory", toCsv(cleaned));
    else next.delete("subcategory");
    next.set("page", "1");
    router.replace(`${pathname || "/"}?${next.toString()}`);
  }, [subcategoryValues, validSubcategorySet, sp, router, pathname]);

  React.useEffect(() => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    let changed = false;
    if (!next.get("sort")) {
      next.set("sort", DEFAULT_SORT);
      changed = true;
    }
    if (!next.get("page")) {
      next.set("page", "1");
      changed = true;
    }
    if (!changed) return;
    router.replace(`${pathname || "/"}?${next.toString()}`);
  }, [sp, router, pathname]);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.replace(qs ? `${pathname || "/"}?${qs}` : pathname || "/");
  }

  function updateFilters(nextValues: {
    cities?: string[];
    categories?: string[];
    subcategories?: string[];
    sort?: SortValue;
  }) {
    const next = new URLSearchParams(sp?.toString() ?? "");

    const nextCities = nextValues.cities ?? cityValues;
    const nextCategories = nextValues.categories ?? categoryValues;
    const nextSubcategories = nextValues.subcategories ?? subcategoryValues;
    const nextSort = nextValues.sort ?? sort;

    setCityValues(nextCities);
    setCategoryValues(nextCategories);
    setSubcategoryValues(nextSubcategories);
    setSort(nextSort);

    if (nextCities.length > 0) next.set("city", toCsv(nextCities));
    else next.delete("city");

    if (nextCategories.length > 0) next.set("category", toCsv(nextCategories));
    else next.delete("category");

    if (nextSubcategories.length > 0)
      next.set("subcategory", toCsv(nextSubcategories));
    else next.delete("subcategory");

    next.set("sort", nextSort);
    next.set("page", "1");
    push(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(sp?.toString() ?? "");
    setCityValues([]);
    setCategoryValues([]);
    setSubcategoryValues([]);
    setSort(DEFAULT_SORT);
    next.delete("city");
    next.delete("category");
    next.delete("subcategory");
    next.set("sort", DEFAULT_SORT);
    next.set("page", "1");
    push(next);
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5 sm:w-56">
        <MultiFilterSelect
          label="Ciudad"
          options={cityOptions}
          selected={cityValues}
          onChange={(nextCities) => updateFilters({ cities: nextCities })}
          allLabel="Todas"
          manyLabel="ciudades"
        />
      </div>

      <div className="space-y-1.5 sm:w-56">
        <MultiFilterSelect
          label="Categoria"
          options={categoryOptions}
          selected={categoryValues}
          onChange={(nextCategories) => {
            const selectedSet = new Set(nextCategories);
            const nextSubs = subcategoryValues.filter((sub) => {
              const pair = pairs.find((p) => p.subcategory === sub);
              if (!pair) return false;
              if (selectedSet.size === 0) return true;
              return selectedSet.has(pair.category);
            });
            updateFilters({
              categories: nextCategories,
              subcategories: nextSubs,
            });
          }}
          allLabel="Todas las categorias"
          manyLabel="categorias"
        />
      </div>

      <div className="space-y-1.5 sm:w-56">
        <MultiFilterSelect
          label="Subcategoria"
          options={subcategoryOptions}
          selected={subcategoryValues.filter((s) => validSubcategorySet.has(s))}
          onChange={(nextSubs) => updateFilters({ subcategories: nextSubs })}
          allLabel="Todas las subcategorias"
          manyLabel="subcategorias"
          disabled={subcategoryOptions.length === 0}
        />
      </div>

      <div className="space-y-1.5 sm:w-56">
        <OrderSelect
          value={sort}
          onChange={(value) => updateFilters({ sort: value })}
        />
      </div>

      <div className="sm:ml-auto">
        <Button variant="outline" onClick={clearFilters} className="rounded-lg">
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
