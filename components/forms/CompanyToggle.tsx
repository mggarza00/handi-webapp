"use client";
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  className?: string;
  label?: string;
  size?: 'sm' | 'md';
};

export default function CompanyToggle({ checked, onChange, id = "company-toggle", className, label = "Represento a una empresa", size = 'md' }: Props) {
  const isSm = size === 'sm';
  const trackSize = isSm ? 'h-5 w-9' : 'h-6 w-11';
  const knobSize = isSm ? 'after:h-4 after:w-4' : 'after:h-5 after:w-5';
  const knobTranslate = isSm ? 'peer-checked:after:translate-x-4' : 'peer-checked:after:translate-x-5';
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <label className="inline-flex items-center cursor-pointer select-none">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.currentTarget.checked)}
          aria-controls="company-fields"
          aria-expanded={checked}
        />
        <div
          className={cn(
            "relative inline-flex items-center rounded-full bg-slate-300 transition-colors",
            trackSize,
            "peer-checked:bg-emerald-500",
            // knob
            "after:absolute after:left-0.5 after:top-0.5 after:rounded-full after:bg-white after:shadow after:transition-transform after:translate-x-0",
            knobSize,
            knobTranslate,
          )}
        />
      </label>
      <label htmlFor={id} className="text-sm cursor-pointer">
        {label}
      </label>
    </div>
  );
}
