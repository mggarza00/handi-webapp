"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "active", label: "Activas" },
  { value: "in_process", label: "En proceso" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
] as const;

function parseCsv(s: string): string[] {
  return (s || "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
function toCsv(arr: string[]): string {
  return arr.join(", ");
}

export default function StatusMultiSelect({
  value,
  onChange,
  placeholder = "Selecciona estatus…",
}: {
  value: string; // CSV (e.g., "active, in_process")
  onChange: (v: string) => void; // CSV normalized
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = React.useMemo(() => new Set(parseCsv(value)), [value]);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const labelRef = React.useRef<HTMLSpanElement | null>(null);
  const [forcedHeight, setForcedHeight] = React.useState<number | null>(null);

  const toggle = (v: string) => {
    const set = new Set(Array.from(selected));
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange(toCsv(Array.from(set)));
  };
  const selectedLabels = STATUS_OPTIONS.filter((o) => selected.has(o.value)).map((o) => o.label);
  const label = selectedLabels.length ? selectedLabels.join(" / ") : placeholder;

  const updateLayout = React.useCallback(() => {
    const el = labelRef.current;
    const btn = btnRef.current;
    if (!el || !btn) return;
    // Measure after frame to ensure layout is updated
    requestAnimationFrame(() => {
      const el2 = labelRef.current;
      const btn2 = btnRef.current;
      if (!el2 || !btn2) return;
      const ls = window.getComputedStyle(el2);
      let lh = parseFloat(ls.lineHeight || "");
      if (!Number.isFinite(lh) || lh <= 0) {
        const fs = parseFloat(ls.fontSize || "16");
        lh = (Number.isFinite(fs) && fs > 0 ? fs : 16) * 1.2;
      }
      const scrollH = el2.scrollHeight;
      const lines = lh > 0 ? Math.round(scrollH / lh) : 1;
      const bs = window.getComputedStyle(btn2);
      const pt = parseFloat(bs.paddingTop || "0") || 0;
      const pb = parseFloat(bs.paddingBottom || "0") || 0;
      const bt = parseFloat(bs.borderTopWidth || "0") || 0;
      const bb = parseFloat(bs.borderBottomWidth || "0") || 0;
      const naturalTotal = Math.ceil(scrollH + pt + pb + bt + bb);

      if (lines >= 2) {
        const target = Math.ceil(naturalTotal * 1.1);
        setForcedHeight((curr) => (curr !== target ? target : curr));
      } else if (forcedHeight !== null) {
        setForcedHeight(null);
      }
    });
  }, [forcedHeight]);

  React.useEffect(() => {
    updateLayout();
  }, [value, label, updateLayout]);

  React.useEffect(() => {
    const btn = btnRef.current;
    const lab = labelRef.current;
    if (!btn || !lab || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateLayout());
    ro.observe(btn);
    ro.observe(lab);
    const onWin = () => updateLayout();
    window.addEventListener("resize", onWin);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWin);
    };
  }, [updateLayout]);

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            ref={btnRef}
            className="justify-between rounded-lg w-auto max-w-full whitespace-normal text-left h-auto"
            style={forcedHeight !== null ? { height: forcedHeight } : undefined}
          >
            <span
              ref={labelRef}
              className={cn("flex-1 min-w-0 break-words", !value.length && "text-slate-500")}
            >
              {label}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selected.has(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => toggle(opt.value)}
                      className="cursor-pointer"
                    >
                      <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {/* chips removidos por requerimiento */}
    </div>
  );
}
