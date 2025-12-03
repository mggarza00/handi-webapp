"use client";
import * as React from "react";
import { X, Search } from "lucide-react";

import { CONDITION_SUGGESTIONS, mapConditionToLabel } from "@/lib/conditions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

type Props = {
  value: string; // chips serializados por coma
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
  triggerClassName?: string;
};

function splitChips(s: string): string[] {
  return (s || "")
    .split(",")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
}
function joinChips(arr: string[]): string {
  return arr.join(", ");
}

export default function ConditionsCombobox({
  value,
  onChange,
  max = 10,
  placeholder = "Agregar condición...",
  triggerClassName,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const chips = React.useMemo(() => splitChips(value).slice(0, max), [value, max]);
  const hasChips = chips.length > 0;

  const normalized = React.useCallback((s: string) => s.replace(/\s+/g, " ").trim(), []);
  const add = React.useCallback(
    (raw: string) => {
      const s = normalized(raw);
      if (!s || s.length < 2 || s.length > 40) return;
      const set = new Set(chips.map((c) => c));
      if (set.has(s) || set.size >= max) return;
      const next = [...chips, s];
      onChange(joinChips(next));
      setQuery("");
      // Mantener abierto para agregar múltiples, como patrón combobox
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [chips, max, normalized, onChange],
  );
  const remove = (idx: number) => {
    const next = chips.filter((_, i) => i !== idx);
    onChange(joinChips(next));
  };

  const filtered = React.useMemo(() => {
    const q = normalized(query).toLowerCase();
    const picked = new Set(chips.map((v) => v.toLowerCase()));
    return CONDITION_SUGGESTIONS.filter((s) => !picked.has(s.value.toLowerCase()))
      .filter((s) => !q || s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))
      .slice(0, 20);
  }, [normalized, query, chips]);

  const canAddCustom = React.useMemo(() => {
    const q = normalized(query);
    if (!q || q.length < 2 || q.length > 40) return false;
    const picked = new Set(chips.map((v) => v.toLowerCase()));
    if (picked.has(q.toLowerCase())) return false;
    const inSuggestions = CONDITION_SUGGESTIONS.some(
      (s) => s.value.toLowerCase() === q.toLowerCase(),
    );
    return !inSuggestions;
  }, [normalized, query, chips]);

  return (
    <div className={cn(hasChips ? "space-y-2" : "space-y-0")}>
      {/* Chips seleccionados */}
      {hasChips ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <Badge
              key={`${c}-${i}`}
              variant="secondary"
              title={c}
              aria-label={c}
              className="px-2 py-1 text-xs bg-secondary/50 text-secondary-foreground/90 border-secondary/30"
            >
              <span>{mapConditionToLabel(c)}</span>
              <button
                type="button"
                aria-label={`Quitar ${c}`}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-slate-200"
                onClick={() => remove(i)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Trigger + Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("inline-flex gap-2", triggerClassName)}
          >
            <span>{placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-2 w-[min(360px,90vw)]">
          <div className="flex items-center gap-2 pb-2">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe para buscar o presiona Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (query) add(query);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              aria-label="Buscar condición"
            />
          </div>
          {canAddCustom ? (
            <div className="pb-2">
              <Button
                type="button"
                variant="default"
                className="w-full justify-start text-sm bg-[#11304a] hover:bg-[#0c2336] text-white"
                onClick={() => add(query)}
                disabled={chips.length >= max}
                title={`Agregar ${query}`}
                aria-label={`Agregar ${query}`}
              >
                {`Agregar ${query}`}
              </Button>
            </div>
          ) : null}
          <div className="max-h-56 overflow-auto">
            {filtered.length > 0 ? (
              <ul role="listbox" aria-label="Sugerencias">
                {filtered.map((s) => (
                  <li key={s.value} role="option" aria-selected={false}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={() => add(s.value)}
                      title={s.value}
                    >
                      {s.label}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-2 py-1 text-xs text-slate-500">Sin sugerencias</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
