"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Chip = {
  name: string;
  color?: string | null;
};

const MAX_INLINE = 3;
const BG_ALPHA = 0.25; // tenue

const normalizeColor = (color?: string | null) => {
  const raw = (color ?? "").toString().trim();
  if (!raw.length) return null;
  const unquoted = raw.replace(/^['"]+|['"]+$/g, "");
  if (!unquoted.length) return null;
  if (
    /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
      unquoted,
    )
  ) {
    return unquoted.startsWith("#") ? unquoted : `#${unquoted}`;
  }
  return unquoted;
};

const hashColor = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // 32bit
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 82%)`;
};

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  if (![3, 4, 6, 8].includes(clean.length)) return null;
  const toFull =
    clean.length === 3 || clean.length === 4
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(toFull.slice(0, 2), 16);
  const g = parseInt(toFull.slice(2, 4), 16);
  const b = parseInt(toFull.slice(4, 6), 16);
  const a = toFull.length === 8 ? parseInt(toFull.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
};

const textColorFor = (_color?: string | null) => "#0f172a";

const withAlpha = (color: string | null | undefined, alpha = 0.8) => {
  const normalized = normalizeColor(color);
  if (!normalized) return undefined;
  if (normalized.startsWith("#")) {
    const rgb = hexToRgb(normalized);
    if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
  if (normalized.startsWith("hsl")) {
    return normalized
      .replace("hsla(", "hsl(")
      .replace("hsl(", "hsla(")
      .replace(")", `, ${alpha})`);
  }
  return normalized;
};

const ChipBadge = ({ name, color }: Chip) => {
  const baseBg = normalizeColor(color) ?? hashColor(name || "");
  const bg = withAlpha(baseBg, BG_ALPHA) ?? baseBg;
  const text = textColorFor(baseBg);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
      style={{ backgroundColor: bg, color: text }}
    >
      {name}
    </span>
  );
};

export default function SubcategoryChips({ items }: { items: Chip[] }) {
  const chips = useMemo(() => {
    const seen = new Set<string>();
    return (items || [])
      .map((item) => ({
        name: (item?.name ?? "").toString().trim(),
        color: item?.color ?? null,
      }))
      .filter((item) => item.name.length > 0)
      .filter((item) => {
        if (seen.has(item.name)) return false;
        seen.add(item.name);
        return true;
      });
  }, [items]);

  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [expanded]);

  if (chips.length === 0) {
    return (
      <p className="text-xs font-semibold text-[#6B7280]">
        Sin subcategorías configuradas.
      </p>
    );
  }

  const visible = chips.slice(0, MAX_INLINE);
  const hidden = chips.slice(MAX_INLINE);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div className="flex items-center gap-2 flex-nowrap overflow-visible pb-1">
          {visible.map((chip) => (
            <ChipBadge key={chip.name} {...chip} />
          ))}
          {hidden.length > 0 ? (
            <div
              className="relative"
              ref={triggerRef}
              onMouseLeave={() => setExpanded(false)}
              onMouseEnter={() => setExpanded(true)}
            >
              <button
                type="button"
                className="inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold text-white shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#082877]"
                style={{
                  borderColor: "var(--color-primary, #082877)",
                  backgroundColor: "var(--color-primary, #082877)",
                }}
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                Ver todas
              </button>
              {expanded ? (
                <div
                  className="fixed z-[9999] w-[min(420px,90vw)] max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
                  style={{
                    top: coords?.top ?? 0,
                    left: coords?.left ?? 0,
                    minWidth: coords?.width ?? undefined,
                  }}
                  onMouseEnter={() => setExpanded(true)}
                  onMouseLeave={() => setExpanded(false)}
                >
                  <div className="flex flex-wrap gap-2">
                    {hidden.map((chip) => (
                      <ChipBadge key={chip.name} {...chip} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
