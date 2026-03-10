"use client";

import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ColoredTag } from "@/lib/profiles/data";

type ServiceTagOverflowProps = {
  tags: ColoredTag[];
  maxVisible?: number;
};

const normalizeColor = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseHexColor = (
  color: string,
): { r: number; g: number; b: number } | null => {
  const clean = color.replace("#", "");
  if (![3, 4, 6, 8].includes(clean.length)) return null;
  const hex =
    clean.length === 3 || clean.length === 4
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
};

const parseRgbColor = (
  color: string,
): { r: number; g: number; b: number } | null => {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return null;
  const [r, g, b] = parts;
  return { r, g, b };
};

const luminance = ({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number => {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const getReadableText = (bgColor: string | null | undefined): string => {
  const bg = normalizeColor(bgColor);
  if (!bg) return "#334155";
  const rgb = parseHexColor(bg) ?? parseRgbColor(bg);
  if (!rgb) return "#334155";
  return luminance(rgb) > 0.62 ? "#0f172a" : "#f8fafc";
};

const getTagStyle = (tag: ColoredTag): React.CSSProperties => {
  const bg = normalizeColor(tag.bgColor) ?? "#f1f5f9";
  const border = normalizeColor(tag.borderColor) ?? "rgba(15, 23, 42, 0.08)";
  const text = normalizeColor(tag.textColor) ?? getReadableText(bg);
  return {
    backgroundColor: bg,
    borderColor: border,
    color: text,
  };
};

const uniqueTags = (tags: ColoredTag[]): ColoredTag[] => {
  const seen = new Set<string>();
  const out: ColoredTag[] = [];
  for (const tag of tags) {
    const name = typeof tag.name === "string" ? tag.name.trim() : "";
    if (!name) continue;
    const type = tag.type === "subcategory" ? "subcategory" : "category";
    const key = `${type}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...tag, name, type });
  }
  return out;
};

function TagChip({ tag }: { tag: ColoredTag }) {
  return (
    <span
      className="inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium"
      style={getTagStyle(tag)}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
}

export default function ServiceTagOverflow({
  tags,
  maxVisible = 7,
}: ServiceTagOverflowProps) {
  const normalized = React.useMemo(() => uniqueTags(tags), [tags]);
  const visible = normalized.slice(0, maxVisible);
  const hidden = normalized.slice(maxVisible);
  const [open, setOpen] = React.useState(false);

  if (!normalized.length) return null;

  return (
    <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
      {visible.map((tag) => (
        <TagChip key={`${tag.type}:${tag.name}`} tag={tag} />
      ))}
      {hidden.length ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
              onMouseEnter={() => setOpen(true)}
            >
              +{hidden.length}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(340px,90vw)] p-3"
            align="start"
            sideOffset={6}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
              {hidden.map((tag) => (
                <TagChip key={`${tag.type}:${tag.name}`} tag={tag} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
