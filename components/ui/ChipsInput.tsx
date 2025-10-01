"use client";
import * as React from "react";
import { X } from "lucide-react";

import { Input } from "./input";
import { toTitleCase, CONDITION_SUGGESTIONS, type ConditionOption } from "@/lib/conditions";

export default function ChipsInput({
  value,
  onChange,
  suggestions = CONDITION_SUGGESTIONS,
  placeholder = "Agrega condición y presiona Enter",
  maxChips = 10,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: ConditionOption[];
  placeholder?: string;
  maxChips?: number;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const normalized = React.useCallback((s: string) => s.replace(/\s+/g, " ").trim(), []);

  const add = React.useCallback(
    (raw: string) => {
      const s = normalized(raw);
      if (!s || s.length < 2 || s.length > 40) return;
      if (value.length >= maxChips) return;
      if (value.includes(s)) return;
      onChange([...value, s]);
      setQuery("");
      setOpen(false);
    },
    [maxChips, normalized, onChange, value],
  );

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const filtered = React.useMemo(() => {
    const q = normalized(query).toLowerCase();
    const picked = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => !picked.has(s.value.toLowerCase()))
      .filter((s) => !q || s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))
      .slice(0, 8);
  }, [normalized, query, suggestions, value]);

  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        {value.map((c, i) => (
          <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            <span>{toTitleCase(c)}</span>
            <button
              type="button"
              aria-label={`Quitar ${c}`}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-200"
              onClick={() => remove(i)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length < maxChips ? (
          <div className="relative min-w-[180px] flex-1">
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
                } else if (e.key === "Backspace" && !query && value.length > 0) {
                  // quick remove last
                  onChange(value.slice(0, -1));
                }
              }}
              placeholder={placeholder}
            />
            {open && filtered.length > 0 ? (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow">
                {filtered.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(s.label)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">Máx. {maxChips} condiciones, 2–40 caracteres c/u.</div>
    </div>
  );
}
