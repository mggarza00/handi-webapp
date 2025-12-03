"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  currency?: string; // default MXN
};

export default function CurrencyInput({ value, onChange, currency = "MXN", className, ...rest }: Props) {
  const fmt = React.useMemo(() => new Intl.NumberFormat("es-MX", { style: "currency", currency }), [currency]);
  const [display, setDisplay] = React.useState<string>(value != null && Number.isFinite(value) ? fmt.format(value) : "");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const next = value != null && Number.isFinite(value) ? fmt.format(value) : "";
    if (next !== display) setDisplay(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fmt]);

  function sanitizeToNumber(raw: string): number | null {
    if (!raw) return null;
    // Keep digits and dot/comma
    const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, ".");
    const parts = cleaned.split(".");
    const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const raw = (e.currentTarget.value || "").toString();
    const num = sanitizeToNumber(raw);
    onChange(num);
    const next = num != null ? fmt.format(num) : "";
    setDisplay(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"]; // navigation
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === "a" || e.key === "c" || e.key === "v" || e.key === "x")) return; // allow common shortcuts
    if (allowed.includes(e.key)) return;
    if (e.key === "." || e.key === ",") return; // decimal
    if (/\d/.test(e.key)) return; // digits
    // block letters and others
    e.preventDefault();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const num = sanitizeToNumber(text);
    if (num == null) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    onChange(num);
    setDisplay(fmt.format(num));
    // place caret at end next tick
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }

  return (
    <input
      ref={inputRef}
      inputMode="decimal"
      {...rest}
      value={display}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn("w-full border rounded px-2 py-1 text-sm", className)}
      placeholder={rest.placeholder ?? "$0.00"}
    />
  );
}
