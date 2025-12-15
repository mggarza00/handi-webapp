"use client";
import * as React from "react";
import Link from "next/link";
import localFont from "next/font/local";

const stackSansMedium = localFont({
  src: "../../public/fonts/Stack_Sans_Text/static/StackSansText-Medium.ttf",
  weight: "500",
  display: "swap",
  variable: "--font-stack-sans-medium",
});

const interFont = localFont({
  src: "../../public/fonts/Inter/Inter-VariableFont_opsz,wght.ttf",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
});

const CARD_WIDTH = 220; // keep in sync with [grid-auto-columns:220px]

type ProItem = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  rating: number | null;
  categories?: unknown;
  subcategories?: unknown;
  city?: string | null;
  years_experience?: number | null;
  jobsDone?: number | null;
};

type Subcategory = {
  id: string;
  name: string;
  color?: string | null;
};

type NormalizedPro = Omit<ProItem, "categories" | "subcategories"> & {
  categories: string[];
  subcategories: Subcategory[];
  primaryCategory: string | null;
  years_experience?: number | null;
  jobsDone?: number | null;
};

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .reduce(
      (acc, cur) => {
        const idx = cur.indexOf("=");
        if (idx === -1) return acc;
        const k = cur.slice(0, idx).trim();
        const v = decodeURIComponent(cur.slice(idx + 1));
        acc[k] = v;
        return acc;
      },
      {} as Record<string, string>,
    );
}

function pickCityFromCookies(): string | null {
  const jar = parseCookies();
  const keys = Object.keys(jar);
  // Heurística: buscar varias claves comunes para ciudad
  const prefer = ["handi_city", "user_city", "city", "location_city", "ciudad"];
  for (const k of prefer) {
    const hit = keys.find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && jar[hit]) return jar[hit];
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed as unknown[];
      } catch {
        /* ignore */
      }
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
};

const toCleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeColorValue = (value?: string | null) => {
  const raw = toCleanString(value);
  if (!raw) return null;
  return raw.replace(/^['"]+|['"]+$/g, "");
};

const normalizeKey = (value?: string | null) =>
  (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

let subcatColorPromise: Promise<Map<string, string>> | null = null;
async function loadSubcategoryColorMap(): Promise<Map<string, string>> {
  if (subcatColorPromise) return subcatColorPromise;
  subcatColorPromise = (async () => {
    const map = new Map<string, string>();
    try {
      const res = await fetch("/api/catalog/categories", {
        cache: "no-store",
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      const j = await res.json().catch(() => null);
      const rows = Array.isArray(j?.data)
        ? (j.data as Array<Record<string, unknown>>)
        : [];
      for (const row of rows) {
        const sub =
          (row.subcategory as string | null | undefined)?.toString().trim() ??
          "";
        const color =
          (row.color as string | null | undefined)?.toString().trim() ?? "";
        if (!sub || !color) continue;
        const key = normalizeKey(sub);
        if (key) map.set(key, color);
      }
    } catch {
      // ignore
    }
    return map;
  })();
  return subcatColorPromise;
}

const normalizeCategories = (value: unknown): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of toArray(value)) {
    const name =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object"
          ? toCleanString(
              (item as Record<string, unknown>).name ??
                (item as Record<string, unknown>).category ??
                (item as Record<string, unknown>)["Categoría"],
            )
          : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
};

const normalizeSubcategories = (value: unknown): Subcategory[] => {
  const seen = new Set<string>();
  const out: Subcategory[] = [];
  for (const item of toArray(value)) {
    const base =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : null;
    const name = base
      ? toCleanString(
          base.name ??
            base.subcategory ??
            base["Subcategoría"] ??
            base.label ??
            base.title,
        )
      : typeof item === "string"
        ? item.trim()
        : "";
    if (!name) continue;
    const color = base
      ? normalizeColorValue(base.color ?? base["Color"] ?? base["color_hex"])
      : null;
    const id = base
      ? toCleanString(
          base.id ??
            base.categories_subcategories_id ??
            base["categories_subcategories_id"],
        )
      : null;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: id || key, name, color: color || null });
  }
  return out;
};

const normalizeProItem = (item: ProItem): NormalizedPro => {
  const categories = normalizeCategories(item.categories);
  const subcategories = normalizeSubcategories(item.subcategories);
  const years =
    typeof item.years_experience === "number" &&
    Number.isFinite(item.years_experience)
      ? item.years_experience
      : null;
  const jobsDone =
    typeof item.jobsDone === "number" &&
    Number.isFinite(item.jobsDone) &&
    item.jobsDone >= 0
      ? item.jobsDone
      : null;
  return {
    ...item,
    categories,
    subcategories,
    primaryCategory: categories[0] ?? null,
    years_experience: years,
    jobsDone,
  };
};

const parseHexColor = (color: string) => {
  const clean = color.replace("#", "");
  if (![3, 4, 6, 8].includes(clean.length)) return null;
  const hex =
    clean.length === 3 || clean.length === 4
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
};

const parseRgbColor = (color: string) => {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return null;
  const [r, g, b] = parts;
  return { r, g, b };
};

const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const pickTextColor = (color?: string | null) => {
  if (!color) return "#ffffff";
  const hex = parseHexColor(color);
  const rgb = hex ?? parseRgbColor(color);
  if (!rgb) return "#ffffff";
  return luminance(rgb) > 0.62 ? "#0f172a" : "#ffffff";
};

const ChipBadge = ({
  name,
  color,
}: {
  name: string;
  color?: string | null;
}) => {
  const bg =
    normalizeColorValue(color) ||
    "var(--chip-subcategory-bg, var(--color-primary, #082877))";
  const textColor = pickTextColor(bg);
  return (
    <span
      className="inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold leading-none shadow-[0_4px_12px_-6px_rgba(15,23,42,0.3)] ring-1 ring-slate-900/5"
      style={{ backgroundColor: bg, color: textColor }}
    >
      {name}
    </span>
  );
};

function SubcategoryChips({
  items,
  onOpenChange,
}: {
  items: Subcategory[];
  onOpenChange?: (open: boolean) => void;
}) {
  const chips = React.useMemo(() => {
    const seen = new Set<string>();
    return (items || []).filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return item.name.trim().length > 0;
    });
  }, [items]);

  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      onOpenChange?.(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (chips.length === 0) return null;

  const visible = chips.slice(0, 1);
  const hidden = chips.slice(1);

  return (
    <div className="mt-2 flex flex-nowrap items-center justify-center gap-2 text-center">
      {visible.map((chip) => (
        <ChipBadge key={chip.id} name={chip.name} color={chip.color} />
      ))}
      {hidden.length > 0 ? (
        <div
          className="relative"
          onMouseLeave={() => {
            setOpen(false);
            onOpenChange?.(false);
          }}
        >
          <button
            type="button"
            ref={triggerRef}
            className="inline-flex h-7 items-center rounded-full bg-slate-900 px-3 text-[11px] font-semibold leading-none text-white shadow-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#082877]"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => {
                onOpenChange?.(!v);
                return !v;
              });
            }}
            onMouseEnter={() => {
              setOpen(true);
              onOpenChange?.(true);
            }}
          >
            +{hidden.length}
          </button>
          {open ? (
            <div
              ref={popoverRef}
              className="absolute left-1/2 top-full z-[9999] flex -translate-x-1/2 flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-2xl w-[min(300px,80vw)] max-h-64 overflow-y-auto"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => {
                setOpen(false);
                onOpenChange?.(false);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="flex flex-wrap justify-center gap-2">
                {hidden.map((chip) => (
                  <ChipBadge
                    key={chip.id}
                    name={chip.name}
                    color={chip.color}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProfessionalCard({ pro }: { pro: NormalizedPro }) {
  const [colorMap, setColorMap] = React.useState<Map<string, string> | null>(
    null,
  );
  const [chipsOpen, setChipsOpen] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    loadSubcategoryColorMap().then((map) => {
      if (mounted) setColorMap(map);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const subcategories = React.useMemo(() => {
    const map = colorMap;
    return (pro.subcategories || [])
      .map((subcat) => {
        const name = (subcat?.name ?? "").toString().trim();
        if (!name) return null;
        const explicitColor = normalizeColorValue(subcat.color);
        const fallback =
          (map &&
            (map.get(normalizeKey(name)) ?? map.get(name.toLowerCase()))) ||
          null;
        return {
          ...subcat,
          name,
          color: explicitColor || fallback || null,
        };
      })
      .filter(Boolean) as Subcategory[];
  }, [pro.subcategories, colorMap]);

  const ratingDisplay =
    typeof pro.rating === "number" && Number.isFinite(pro.rating)
      ? Number.isInteger(pro.rating)
        ? pro.rating.toString()
        : Number(pro.rating).toFixed(1)
      : "—";
  const servicesDisplay =
    typeof pro.jobsDone === "number" && pro.jobsDone >= 0
      ? pro.jobsDone.toString()
      : "—";
  const years =
    typeof pro.years_experience === "number" && pro.years_experience > 0
      ? pro.years_experience
      : null;
  const yearsDisplay =
    years != null ? `${years} ${years === 1 ? "año" : "años"}` : "— años";

  return (
    <div
      className={`min-w-[220px] max-w-[220px] flex-shrink-0 ${
        chipsOpen ? "relative z-[999]" : ""
      }`}
    >
      <Link
        href={`/profiles/${pro.id}`}
        className="group relative flex h-full flex-col items-center justify-start rounded-2xl bg-white px-5 pb-8 pt-12 text-center shadow-[0_14px_45px_-28px_rgba(8,40,119,0.55)] ring-1 ring-slate-100 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_60px_-26px_rgba(8,40,119,0.6)]"
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pro.avatar_url || "/images/handee_mascota.gif"}
            alt={pro.full_name || "Avatar"}
            className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-lg"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={(e) => {
              const t = e.currentTarget as HTMLImageElement & {
                dataset?: Record<string, string>;
              };
              if (t && (!t.dataset || !t.dataset.fallbackApplied)) {
                t.src = "/images/handee_mascota.gif";
                if (t.dataset) t.dataset.fallbackApplied = "1";
              }
            }}
          />
        </div>
        <div className="mt-4 text-base font-semibold tracking-tight text-slate-900 line-clamp-1">
          {pro.full_name ?? "Profesional"}
        </div>
        <div className="mt-1 text-sm text-slate-600 line-clamp-1">
          {pro.primaryCategory ??
            pro.headline ??
            pro.bio ??
            "Categoría pendiente"}
        </div>
        <SubcategoryChips items={subcategories} onOpenChange={setChipsOpen} />
        <div
          className={`mt-4 flex w-full items-center justify-between gap-3 text-center text-[10px] text-slate-500 ${interFont.className}`}
        >
          <div className="flex-1">
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {ratingDisplay}
            </div>
            <div className="tracking-tight lowercase">calificación</div>
          </div>
          <div className="h-9 w-px bg-slate-200" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {servicesDisplay}
            </div>
            <div className="tracking-tight lowercase">servicios</div>
          </div>
          <div className="h-9 w-px bg-slate-200" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {yearsDisplay}
            </div>
            <div className="tracking-tight lowercase">experiencia</div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function NearbyCarousel() {
  const [items, setItems] = React.useState<NormalizedPro[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [city, setCity] = React.useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = React.useState<number>(12);
  const [showSecondRow, setShowSecondRow] = React.useState<boolean>(false);

  React.useEffect(() => {
    setCity(pickCityFromCookies());
  }, []);

  React.useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (city && city.trim()) qs.set("city", city.trim());
        const res = await fetch(
          `/api/professionals${qs.toString() ? `?${qs.toString()}` : ""}`,
          {
            headers: { "Content-Type": "application/json; charset=utf-8" },
            cache: "no-store",
            credentials: "include",
          },
        );
        const j = await res.json().catch(() => ({}));
        let data: ProItem[] = Array.isArray(j?.data)
          ? (j.data as ProItem[])
          : [];
        // Si no hay ciudad conocida, mostrar aleatorios
        if (!city) data = shuffle(data);
        const normalized = data.map((item) => normalizeProItem(item));
        if (!abort) setItems(normalized.slice(0, 12));
      } catch {
        if (!abort) setItems([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [city]);

  // Calcular cuántas tarjetas caben completas (2 filas) y ocultar el resto
  React.useEffect(() => {
    function compute() {
      const el = gridRef.current;
      if (!el) return;
      const styles = window.getComputedStyle(el);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const cardW = CARD_WIDTH; // coincide con grid-auto-columns y min/max de la tarjeta
      const totalW = el.clientWidth;
      const cols = Math.max(
        1,
        Math.min(4, Math.floor((totalW + gap) / (cardW + gap))),
      );
      const rows = showSecondRow ? 2 : 1;
      const cap = Math.max(0, cols * rows);
      setVisibleCount(Math.min(12, items.length, cap));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("resize", compute);
    };
  }, [items.length, showSecondRow]);

  if (loading) return null;
  if (!items || items.length === 0) return null;

  const shown = items.slice(0, visibleCount);
  return (
    <div className="mt-12 mx-[calc(50%-50vw)] w-screen px-[var(--site-gutter)]">
      <div className="rounded-[32px] bg-white px-4 py-12 shadow-[0_22px_70px_-40px_rgba(8,40,119,0.45)] ring-1 ring-slate-100/80 md:px-8">
        <div className="mb-12 text-center">
          <h3
            className={`${stackSansMedium.className} text-4xl font-semibold tracking-tight text-[#082877]`}
          >
            Profesionales cerca de ti
          </h3>
        </div>
        <div
          ref={gridRef}
          className={`mt-24 grid ${showSecondRow ? "grid-rows-2" : "grid-rows-1"} [grid-auto-flow:column] [grid-auto-columns:220px] gap-x-8 gap-y-14 px-2 md:px-4 relative overflow-visible justify-center justify-items-center`}
        >
          {shown.map((p) => (
            <ProfessionalCard key={p.id} pro={p} />
          ))}
        </div>
        <div className="mt-6 flex justify-center z-0 relative overflow-visible">
          {!showSecondRow && visibleCount < Math.min(items.length, 12) ? (
            <button
              type="button"
              onClick={() => setShowSecondRow(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
              aria-label="Mostrar más profesionales"
            >
              Mostrar más
            </button>
          ) : (
            <Link
              href="/professionals"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#082877] px-5 text-sm font-semibold text-white shadow-[0_16px_40px_-20px_rgba(8,40,119,0.6)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_48px_-20px_rgba(8,40,119,0.65)]"
            >
              Ver todos
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ProItem, NormalizedPro };
export { normalizeProItem };
