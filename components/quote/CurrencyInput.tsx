"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  value: number | undefined;
  onValueChange: (n: number | undefined) => void;
};

export function CurrencyInput({ value, onValueChange, className, ...rest }: Props) {
  const nf = React.useMemo(() => new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  const [display, setDisplay] = React.useState(
    typeof value === "number" ? nf.format(value) : "",
  );
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (focused) return; // don't override while typing
    if (typeof value === "number") {
      setDisplay(nf.format(value));
    } else if (value === undefined) {
      setDisplay("");
    }
  }, [value, nf, focused]);

  function parseToNumber(raw: string) {
    const digits = raw.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    const n = Number(digits);
    return Number.isFinite(n) ? n : undefined;
  }

  return (
    <div className="relative">
      <span className="pointer-events-none select-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-700">$</span>
      <input
        {...rest}
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          const n = parseToNumber(e.target.value);
          onValueChange(n);
          setDisplay(e.target.value);
        }}
        onFocus={(e) => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          if (typeof value === "number") {
            setDisplay(nf.format(value));
          } else {
            setDisplay("");
          }
        }}
        aria-label={rest["aria-label"] ?? "Monto MXN"}
        placeholder={rest.placeholder ?? "0.00"}
        className={cn(
          // Match shadcn Input styles
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          "pl-7 text-left",
          className,
        )}
      />
    </div>
  );
}
