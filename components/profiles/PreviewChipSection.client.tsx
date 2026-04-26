"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type PreviewChipItem = {
  key: string;
  label: string;
  className?: string;
  style?: React.CSSProperties;
};

type Props = {
  title: string;
  items: PreviewChipItem[];
  emptyText: string;
  className?: string;
};

export default function PreviewChipSection({
  title,
  items,
  emptyText,
  className,
}: Props) {
  const normalized = React.useMemo(() => {
    const seen = new Set<string>();
    const next: PreviewChipItem[] = [];

    for (const item of items) {
      const label = item.label.trim();
      if (!label) continue;
      const key = item.key.trim() || label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ ...item, key, label });
    }

    return next;
  }, [items]);
  const [expanded, setExpanded] = React.useState(false);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = React.useState(false);

  React.useEffect(() => {
    const node = previewRef.current;
    if (!node) return undefined;

    let frame = 0;
    const measure = () => {
      setHasOverflow(node.scrollWidth - node.clientWidth > 6);
    };
    const scheduleMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (frame) window.cancelAnimationFrame(frame);
      };
    }

    const observer = new ResizeObserver(() => {
      scheduleMeasure();
    });
    observer.observe(node);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [normalized]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/88 p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {normalized.length ? (
          <span className="text-xs font-medium text-slate-500">
            {normalized.length}
          </span>
        ) : null}
      </div>

      {normalized.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-500">
          {emptyText}
        </div>
      ) : (
        <>
          {expanded ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {normalized.map((item) => (
                <span
                  key={item.key}
                  className={cn(
                    "inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-xs font-medium leading-5",
                    item.className,
                  )}
                  style={item.style}
                  title={item.label}
                >
                  {item.label}
                </span>
              ))}
            </div>
          ) : (
            <div className="relative mt-3">
              <div
                ref={previewRef}
                className="flex overflow-hidden whitespace-nowrap pr-8"
              >
                <div className="flex min-w-max gap-2">
                  {normalized.map((item) => (
                    <span
                      key={item.key}
                      className={cn(
                        "inline-flex min-h-8 shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium leading-5",
                        item.className,
                      )}
                      style={item.style}
                      title={item.label}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
              {hasOverflow ? (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white via-white/95 to-transparent" />
              ) : null}
            </div>
          )}

          {hasOverflow ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="text-xs font-semibold text-[#082877] transition hover:text-[#061c53]"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "Ver menos" : "Ver todas"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
