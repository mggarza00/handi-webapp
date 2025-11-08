"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Plus, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import RAW_TAXONOMY from "@/data/categories.json";

const TAXONOMY_FALLBACK: Array<{ name: string; subcategories: string[] }> = [
  { name: "Limpieza", subcategories: ["Industrial", "Residencial", "Pulido y encerado de pisos"] },
  { name: "Mantenimiento", subcategories: ["Eléctrico", "Plomería", "Pintura"] },
  { name: "Jardinería y Exterior", subcategories: ["Poda", "Riego", "Césped"] },
  { name: "Construcción y Remodelación", subcategories: ["Albañilería", "Yeso", "Tablaroca"] },
] as const;

type Pick = { category: string; subcategory?: string | null };
type Opt = { category: string; subcategory: string | null; icon?: string | null };

function uniq<T>(arr: T[], by: (t: T) => string): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const it of arr) {
    const k = by(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

function DefaultCategoryPicker({
  value,
  onChange,
  initialCategories,
  initialSubcategories,
  overrideTaxonomy,
  single = false,
  showChips = true,
  triggerTestId,
  centered = false,
}: {
  value: Pick[];
  onChange: (next: Pick[]) => void;
  initialCategories?: string[];
  initialSubcategories?: string[];
  overrideTaxonomy?: Tax[];
  single?: boolean;
  showChips?: boolean;
  triggerTestId?: string;
  centered?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<Opt[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const catRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const norm = (s: string | null | undefined) =>
          (s ?? "").toString().normalize?.("NFKC").toLowerCase().trim();
        // If a taxonomy override is provided, use it directly
        if (overrideTaxonomy && overrideTaxonomy.length) {
          const arr: Opt[] = [];
          for (const t of overrideTaxonomy) {
            const cat = String(t?.name || "").trim();
            if (!cat) continue;
            const subs = String(t?.subs || "");
            const parts = subs.split(",").map((s) => s.trim()).filter(Boolean);
            if (parts.length) {
              for (const s of parts) arr.push({ category: cat, subcategory: s });
            } else {
              arr.push({ category: cat, subcategory: null });
            }
          }
          if (!cancelled) setOptions(arr);
          // seed initial picks from provided initial values
          if (!cancelled && value.length === 0 && (initialCategories?.length || initialSubcategories?.length)) {
            const picks: Pick[] = [];
            // Expand initial categories into their subcategories only (no whole-category picks)
            for (const c of initialCategories || []) {
              if (!c || !c.trim()) continue;
              const cN = norm(c);
              for (const o of arr) {
                if (norm(o.category) === cN && o.subcategory) picks.push({ category: o.category, subcategory: o.subcategory });
              }
            }
            for (const s of initialSubcategories || []) {
              if (!s || !s.trim()) continue;
              const sN = norm(s);
              const match = arr.find((o) => norm(o.subcategory) === sN) || null;
              if (match?.category) picks.push({ category: match.category, subcategory: match.subcategory });
            }
            onChange(uniq(picks, (p) => `${p.category}::${p.subcategory || ""}`));
          }
          return;
        }
        // Try API source first
        const r = await fetch("/api/catalog/categories", { headers: { "Content-Type": "application/json; charset=utf-8" } });
        const j = await r.json().catch(() => null);
        const arr: Opt[] = Array.isArray(j?.data)
          ? j.data.map((x: any) => ({ category: String(x.category || ""), subcategory: x.subcategory || null, icon: x.icon || null }))
          : [];
        let loaded: Opt[] = [];
        if (!cancelled && arr.length) {
          loaded = arr;
          setOptions(arr);
        } else {
          // Fallback to bundled taxonomy JSON
          const fallback: Opt[] = [];
          const raw: Array<{ name?: string; subcategories?: Array<{ name?: string; icon?: string }> }>
            = (RAW_TAXONOMY as any) as Array<{ name?: string; subcategories?: Array<{ name?: string; icon?: string }> }>;
          for (const c of raw) {
            const cat = String(c?.name || "").trim();
            if (!cat) continue;
            if (Array.isArray(c.subcategories) && c.subcategories.length) {
              for (const s of c.subcategories) {
                const sub = String(s?.name || "").trim() || null;
                const icon = (s?.icon ? String(s.icon) : "").trim() || null;
                fallback.push({ category: cat, subcategory: sub, icon });
              }
            } else {
              fallback.push({ category: cat, subcategory: null });
            }
          }
          // If still empty, seed from hardcoded fallback taxonomy
          let out = fallback;
          if (!out.length) {
            out = TAXONOMY_FALLBACK.flatMap((g) => g.subcategories.map((s) => ({ category: g.name, subcategory: s })));
          }
          loaded = out;
          if (!cancelled) setOptions(out);
        }
        // Seed selections from initial values using loaded options
        if (!cancelled && value.length === 0 && (initialCategories?.length || initialSubcategories?.length)) {
          const picks: Pick[] = [];
          for (const c of initialCategories || []) {
            if (!c || !c.trim()) continue;
            const cN = norm(c);
            for (const o of loaded) {
              if (norm(o.category) === cN && o.subcategory) picks.push({ category: o.category, subcategory: o.subcategory });
            }
          }
          for (const s of initialSubcategories || []) {
            if (!s || !s.trim()) continue;
            const sN = norm(s);
            const match = loaded.find((o) => norm(o.subcategory) === sN) || null;
            if (match?.category) picks.push({ category: match.category, subcategory: match.subcategory });
          }
          onChange(uniq(picks, (p) => `${p.category}::${p.subcategory || ""}`));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCat = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const o of options) {
      const arr = map.get(o.category) || [];
      if (o.subcategory) arr.push(o.subcategory);
      map.set(o.category, arr);
    }
    return map;
  }, [options]);

  const key = (x: Pick) => `${x.category}::${x.subcategory || ""}`;
  const hasPick = (p: Pick) => value.some((x) => x.category === p.category && (x.subcategory || null) === (p.subcategory || null));

  const selectedSubsSet = (cat: string) => new Set(value.filter((p) => p.category === cat && p.subcategory).map((p) => String(p.subcategory)));
  const hasCatPick = (cat: string) => hasPick({ category: cat });
  const allSubs = (cat: string) => byCat.get(cat) || [];
  const isCatFullySelected = (cat: string) => (allSubs(cat).length > 0 && allSubs(cat).every((s) => selectedSubsSet(cat).has(s)));

  const addPicks = (...p: Pick[]) => onChange(uniq([...value, ...p], key));
  const removePicksWhere = (pred: (p: Pick) => boolean) => onChange(value.filter((p) => !pred(p)));

  // Category rows expand/collapse. When opening, ensure it scrolls into view within the dropdown.
  const toggleCategory = (cat: string) => {
    const nextOpen = !(expanded[cat] === true);
    setExpanded((e) => {
      if (nextOpen) {
        // close others, open only this one
        return { [cat]: true } as Record<string, boolean>;
      }
      // closing this one
      const copy = { ...e } as Record<string, boolean>;
      delete copy[cat];
      return copy;
    });
    if (nextOpen) {
      try {
        requestAnimationFrame(() => {
          const el = catRefs.current[cat];
          if (el) el.scrollIntoView({ block: "nearest" });
        });
      } catch {
        /* ignore */
      }
    }
  };

  const toggleSub = (cat: string, sub: string) => {
    if (single) {
      const p = { category: cat, subcategory: sub } as Pick;
      const isSelected = hasPick(p);
      const next = isSelected ? [] : [p];
      onChange(next);
      setOpen(false);
      return;
    }
    if (hasCatPick(cat)) {
      // Expand category selection to explicit subcats, then remove the toggled one
      const subs = allSubs(cat);
      const rest = subs.filter((s) => s !== sub);
      const add: Pick[] = rest.map((s) => ({ category: cat, subcategory: s }));
      const removeCat = (p: Pick) => p.category === cat && !p.subcategory;
      onChange(uniq([...value.filter((p) => !removeCat(p)), ...add], key));
      return;
    }
    const p = { category: cat, subcategory: sub } as Pick;
    if (hasPick(p)) removePicksWhere((it) => it.category === cat && it.subcategory === sub);
    else addPicks(p);
  };

  const label = React.useMemo(() => {
    if (single) {
      if (value.length === 1) {
        const v = value[0];
        return v.subcategory ? `${v.category} - ${v.subcategory}` : v.category;
      }
      return "Selecciona subcategoría…";
    }
    return value.length ? `${value.length} seleccionada(s)` : "Selecciona subcategorías…";
  }, [single, value]);

  // No auto-expand on open: keep categories closed until user interacts.

  // Rich label node: when single selection and we know the icon, show "Categoría - (icon) Subcategoría"
  const labelNode = React.useMemo(() => {
    if (single && value.length === 1) {
      const v = value[0];
      const opt = options.find((o) => o.category === v.category && o.subcategory === (v.subcategory || null));
      const icon = opt?.icon || null;
      const isImg = !!(icon && (/^https?:\/\//.test(icon) || icon.startsWith("/") || /\.(png|jpe?g|gif|svg)$/i.test(icon)));
      return (
        <span className="inline-flex items-center gap-1 truncate">
          <span className="truncate">{v.category}</span>
          <span className="opacity-50">-</span>
          {icon ? (
            isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="h-4 w-4 object-contain" />
            ) : (
              <span aria-hidden className="text-base leading-none">{icon}</span>
            )
          ) : null}
          {v.subcategory ? <span className="truncate">{v.subcategory}</span> : null}
        </span>
      );
    }
    return label;
  }, [single, value, options, label]);

  const renderList = () => (
    loading ? (
      <div className="py-6 text-center text-sm">Cargando…</div>
    ) : (
      <div className="max-h-[70vh] overflow-y-auto">
        {Array.from(byCat.keys()).map((cat) => {
          const subs = allSubs(cat);
          const openCat = expanded[cat] === true;
          const full = isCatFullySelected(cat);
          const count = selectedSubsSet(cat).size;
          return (
            <div key={cat} ref={(el) => { catRefs.current[cat] = el; }} className="border-b last:border-b-0 py-1">
              <div
                className="flex items-center gap-2 cursor-pointer"
                role="button"
                aria-expanded={openCat}
                onClick={() => toggleCategory(cat)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategory(cat);
                  }
                }}
                tabIndex={0}
              >
                <div className="flex items-center gap-2 text-left">
                  <Check className={cn("h-4 w-4", full ? "opacity-100" : "opacity-0")} />
                  <span className="text-sm">{cat}</span>
                  {count > 0 && !full ? (
                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{count}</span>
                  ) : null}
                </div>
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setExpanded((e) => {
                        if (!openCat) return { [cat]: true } as Record<string, boolean>;
                        const copy = { ...e } as Record<string, boolean>;
                        delete copy[cat];
                        return copy;
                      });
                    }}
                    aria-label={openCat ? "Ocultar" : "Mostrar"}
                  >
                    {openCat ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {openCat && subs.length > 0 && (
                <div className="mt-1 space-y-1 pl-6">
                  {subs.map((s) => {
                    const checked = full || selectedSubsSet(cat).has(s);
                    const opt = options.find((o) => o.category === cat && o.subcategory === s);
                    const icon = opt?.icon || null;
                    const isImg = !!(icon && (/^https?:\/\//.test(icon) || icon.startsWith("/") || /\.(png|jpe?g|gif|svg)$/i.test(icon)));
                    return (
                      <label key={`${cat}::${s}`} className="flex items-center gap-2 text-sm" role="option">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={checked}
                          onChange={() => toggleSub(cat, s)}
                        />
                        {icon ? (
                          isImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={icon} alt="" className="h-4 w-4 object-contain" />
                          ) : (
                            <span aria-hidden className="text-base leading-none">{icon}</span>
                          )
                        ) : null}
                        <span>{s}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )
  );

  // For centered floating panel (non-modal), manage outside clicks and ESC
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!centered || !open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (triggerRef.current && triggerRef.current.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [centered, open]);

  return (
    <div>
      {centered ? (
        <>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            data-testid={triggerTestId}
            onClick={() => setOpen((o) => !o)}
            type="button"
          >
            <span className={cn("truncate inline-flex items-center gap-1", !value.length && "text-slate-500")}>{labelNode}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
          {mounted && open && createPortal(
            <div
              ref={panelRef}
              className="fixed left-1/2 top-1/2 z-[80] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-2 shadow-lg sm:w-[36rem]"
              role="dialog"
              aria-modal={false}
            >
              {renderList()}
            </div>,
            document.body,
          )}
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between" data-testid={triggerTestId} type="button">
              <span className={cn("truncate inline-flex items-center gap-1", !value.length && "text-slate-500")}>{labelNode}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-2 sm:w-[36rem]">
            {renderList()}
          </PopoverContent>
        </Popover>
      )}
      {showChips && value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((p) => {
            const opt = options.find((o) => o.category === p.category && o.subcategory === (p.subcategory || null));
            const icon = opt?.icon || null;
            const isImg = !!(icon && (/^https?:\/\//.test(icon) || icon.startsWith("/") || /\.(png|jpe?g|gif|svg)$/i.test(icon)));
            return (
              <Badge
                key={`${p.category}::${p.subcategory || ""}`}
                variant="secondary"
                className="flex flex-col sm:flex-row items-start sm:items-center gap-0.5 sm:gap-1.5 text-left max-w-full"
              >
                {icon ? (
                  isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icon} alt="" className="mt-0.5 h-3.5 w-3.5 object-contain" />
                  ) : (
                    <span aria-hidden className="text-sm leading-none">{icon}</span>
                  )
                ) : null}
                {p.subcategory ? (
                  <>
                    <span className="hidden sm:inline">{p.category} — {p.subcategory}</span>
                    <span className="sm:hidden block">{p.category}</span>
                    <span className="sm:hidden block">{p.subcategory}</span>
                  </>
                ) : (
                  <span>{p.category}</span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== p))}
                  aria-label="Quitar"
                  className="ml-1 inline-flex sm:self-auto self-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DefaultCategoryPicker;

export type Tax = { name: string; subs: string };

export function CategoryPicker({
  taxonomy,
  valueCats,
  valueSubs,
  onChange,
}: {
  taxonomy?: Tax[];
  valueCats: string; // CSV
  valueSubs: string; // CSV
  onChange: (cats: string, subs: string) => void;
}) {
  const parseCsv = (s: string) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
  const [picks, setPicks] = React.useState<Pick[]>([]);
  const initCats = React.useMemo(() => parseCsv(valueCats), [valueCats]);
  const initSubs = React.useMemo(() => parseCsv(valueSubs), [valueSubs]);

  React.useEffect(() => {
    // Whenever picks change, push CSVs upward
    const cats = Array.from(new Set(picks.map((p) => p.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));
    const subs = picks.map((p) => p.subcategory || "").filter(Boolean).sort((a,b)=>a.localeCompare(b,'es')) as string[];
    onChange(cats.join(", "), subs.join(", "));
  }, [picks, onChange]);

  return (
    <DefaultCategoryPicker
      value={picks}
      onChange={setPicks}
      initialCategories={initCats}
      initialSubcategories={initSubs}
      overrideTaxonomy={taxonomy}
    />
  );
}
