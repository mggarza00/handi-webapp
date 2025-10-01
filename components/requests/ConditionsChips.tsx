"use client";
import * as React from "react";

import { CONDITION_SUGGESTIONS, mapConditionToLabel } from "@/lib/conditions";

import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
  "aria-label"?: string;
};

// Convierte string serializado → array de chips
function splitChips(s: string): string[] {
  return (s || "")
    .split(",")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
}

// Convierte array de chips → string serializado
function joinChips(arr: string[]): string {
  return arr.join(", ");
}

export default function ConditionsChips({
  value,
  onChange,
  max = 10,
  placeholder = "Escribe y presiona Enter…",
  ...rest
}: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const chips = React.useMemo(() => splitChips(value).slice(0, max), [value, max]);

  const normalized = React.useCallback((s: string) => s.replace(/\s+/g, " ").trim(), []);

  const add = React.useCallback(
    (raw: string) => {
      const s = normalized(raw);
      if (!s || s.length < 2 || s.length > 40) return;
      const set = new Set(chips);
      if (set.has(s) || set.size >= max) return;
      const next = [...chips, s];
      onChange(joinChips(next));
      setQuery("");
      setOpen(false);
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
      .slice(0, 8);
  }, [normalized, query, chips]);

  // Límite total de longitud (visual) no se impone aquí, solo count y tamaño chip
  return (
    <div>
      <div className="rounded border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              title={c}
              aria-label={c}
            >
              <span>{mapConditionToLabel(c)}</span>
              <button
                type="button"
                aria-label={`Quitar ${c}`}
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-200"
                onClick={() => remove(i)}
              >
                ×
              </button>
            </span>
          ))}
          {chips.length < max ? (
            <div className="relative min-w-[200px] flex-1">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    if (query) add(query);
                  } else if (e.key === "Backspace" && !query && chips.length > 0) {
                    e.preventDefault();
                    remove(chips.length - 1);
                  }
                }}
                placeholder={placeholder}
                aria-autocomplete="list"
                role="combobox"
                aria-expanded={open}
                aria-controls="conditions-suggestions"
                {...rest}
              />
              {open && filtered.length > 0 ? (
                <div
                  id="conditions-suggestions"
                  role="listbox"
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow"
                >
                  {filtered.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(s.value)}
                      title={s.value}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{chips.length}/{max}</div>
    </div>
  );
}

