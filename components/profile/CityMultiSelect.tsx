"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DEFAULT_CITIES = [
  "Monterrey",
  "San Pedro",
  "Guadalupe",
  "Apodaca",
  "Santa Catarina",
  "Escobedo",
] as const;

type CityApiItem = { name?: string | null };

export function CityMultiSelect({
  value,
  onChange,
  options,
  fetchUrl = "/api/cities",
  placeholder = "Selecciona ciudades…",
}: {
  value: string; // CSV (e.g., "Monterrey, Guadalupe")
  onChange: (v: string) => void; // CSV normalized
  options?: string | string[]; // CSV or array
  fetchUrl?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [optList, setOptList] = React.useState<string[]>(Array.from(DEFAULT_CITIES));
  const [loading, setLoading] = React.useState(false);

  const parseCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const toCsv = (arr: string[]) => arr.join(", ");

  React.useEffect(() => {
    if (options && (Array.isArray(options) ? options.length : String(options).trim().length > 0)) {
      const arr = Array.isArray(options) ? options : parseCsv(String(options));
      setOptList(Array.from(new Set(arr)));
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(fetchUrl, { headers: { "Content-Type": "application/json; charset=utf-8" } });
        const j = await r.json().catch(() => null);
        const arr: string[] | null = Array.isArray(j?.data)
          ? (j.data as CityApiItem[])
              .map((x) => (typeof x?.name === "string" ? x.name : null))
              .filter((city): city is string => Boolean(city))
          : null;
        if (!cancelled && arr && arr.length) setOptList(Array.from(new Set(arr)));
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl, options]);

  const selected = React.useMemo(() => new Set(parseCsv(value)), [value]);

  const toggle = (city: string) => {
    const set = new Set(Array.from(selected));
    if (set.has(city)) set.delete(city);
    else set.add(city);
    onChange(toCsv(Array.from(set)));
  };

  const remove = (city: string) => {
    const set = new Set(Array.from(selected));
    set.delete(city);
    onChange(toCsv(Array.from(set)));
  };

  const count = Array.from(selected).length;
  const label = count ? `${count} seleccionada(s)` : placeholder;

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className={cn("truncate", !value.length && "text-slate-500")}>{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandEmpty>{loading ? "Cargando…" : "Sin resultados"}</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {optList.map((opt) => {
                  const isSelected = selected.has(opt);
                  return (
                    <CommandItem
                      key={opt}
                      onSelect={() => toggle(opt)}
                      className="cursor-pointer"
                    >
                      <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      {opt}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {count > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Array.from(selected).map((c) => (
            <Badge key={c} variant="secondary" className="flex items-center gap-1">
              {c}
              <button type="button" onClick={() => remove(c)} aria-label={`Quitar ${c}`} className="ml-1 inline-flex">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default CityMultiSelect;
