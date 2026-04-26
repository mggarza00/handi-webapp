"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  items: string[];
  maxVisible?: number;
  emptyText?: string;
  className?: string;
  chipClassName?: string;
  toggleClassName?: string;
  singleLine?: boolean;
};

export default function ExpandableChipList({
  items,
  maxVisible = 6,
  emptyText,
  className,
  chipClassName,
  toggleClassName,
  singleLine = false,
}: Props) {
  const normalized = useMemo(
    () =>
      Array.from(
        new Set(
          items.map((item) => item.trim()).filter((item) => item.length > 0),
        ),
      ),
    [items],
  );
  const [expanded, setExpanded] = useState(false);

  if (!normalized.length) {
    return emptyText ? (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
        {emptyText}
      </div>
    ) : null;
  }

  const visible = expanded ? normalized : normalized.slice(0, maxVisible);
  const hasOverflow = normalized.length > maxVisible;

  return (
    <div
      className={cn(
        "flex gap-2",
        singleLine
          ? "overflow-x-auto pb-1 pr-1 whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap",
        className,
      )}
    >
      {visible.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700",
            singleLine && "shrink-0 whitespace-nowrap",
            chipClassName,
          )}
        >
          {item}
        </span>
      ))}
      {hasOverflow ? (
        <button
          type="button"
          className={cn(
            "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[#082877] transition hover:bg-slate-50",
            singleLine && "shrink-0 whitespace-nowrap",
            toggleClassName,
          )}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Ver menos" : "Ver todas"}
        </button>
      ) : null}
    </div>
  );
}
