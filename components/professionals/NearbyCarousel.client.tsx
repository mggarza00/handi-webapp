"use client";
import * as React from "react";
import Link from "next/link";

import RatingStars from "@/components/ui/RatingStars";

type ProItem = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  rating: number | null;
  categories?: string[];
  subcategories?: string[];
  city?: string | null;
};

function parseCookies(): Record<string, string> {
  if (typeof document === "undefined") return {};
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .reduce((acc, cur) => {
      const idx = cur.indexOf("=");
      if (idx === -1) return acc;
      const k = cur.slice(0, idx).trim();
      const v = decodeURIComponent(cur.slice(idx + 1));
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);
}

function pickCityFromCookies(): string | null {
  const jar = parseCookies();
  const keys = Object.keys(jar);
  // Heurística: buscar varias claves comunes para ciudad
  const prefer = [
    "handi_city",
    "user_city",
    "city",
    "location_city",
    "ciudad",
  ];
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

export default function NearbyCarousel() {
  const [items, setItems] = React.useState<ProItem[]>([]);
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
        const res = await fetch(`/api/professionals${qs.toString() ? `?${qs.toString()}` : ""}`, {
          headers: { "Content-Type": "application/json; charset=utf-8" },
          cache: "no-store",
          credentials: "include",
        });
        const j = await res.json().catch(() => ({}));
        let data: ProItem[] = Array.isArray(j?.data) ? (j.data as ProItem[]) : [];
        // Si no hay ciudad conocida, mostrar aleatorios
        if (!city) data = shuffle(data);
        if (!abort) setItems(data.slice(0, 12));
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
      const cardW = 200; // coincide con grid-auto-columns y min/max de la tarjeta
      const totalW = el.clientWidth;
      const cols = Math.floor((totalW + gap) / (cardW + gap));
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
    <div className="mt-12 rounded-xl px-3 py-4 md:px-4 md:py-6">
      <div className="mb-3 text-center">
        <h3 className="text-lg font-semibold tracking-tight text-black">Profesionales cerca de ti</h3>
      </div>
      <div
        ref={gridRef}
        className={
          "grid " +
          (showSecondRow ? "grid-rows-2 " : "grid-rows-1 ") +
          "[grid-auto-flow:column] [grid-auto-columns:200px] gap-3 overflow-hidden justify-center justify-items-center"
        }
      >
        {shown.map((p) => (
          <div key={p.id} className="min-w-[200px] max-w-[200px] flex-shrink-0 relative glass-noise rounded-3xl overflow-hidden">
            <Link
              href={`/profiles/${p.id}`}
              className="relative z-10 overflow-hidden rounded-3xl p-4 md:p-6 isolate bg-[rgba(255,255,255,0.07)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/20 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.45)] before:content-[''] before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-b before:from-[rgba(255,245,230,0.35)] before:via-[rgba(255,255,255,0.12)] before:to-[rgba(120,90,60,0.08)] before:opacity-80 after:content-[''] after:absolute after:-top-12 after:-left-10 after:h-52 after:w-52 after:rounded-full after:bg-[rgba(255,200,160,0.18)] after:blur-[70px] after:opacity-90 transition-all duration-300 text-white/[0.92] hover:-translate-y-[2px] hover:shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)]"
            >
            <span className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/10 z-20" />
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.avatar_url || "/images/handee_mascota.gif"}
                alt={p.full_name || "Avatar"}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/40"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e) => {
                  const t = e.currentTarget as HTMLImageElement & { dataset?: Record<string, string> };
                  if (t && (!t.dataset || !t.dataset.fallbackApplied)) {
                    t.src = "/images/handee_mascota.gif";
                    if (t.dataset) t.dataset.fallbackApplied = "1";
                  }
                }}
              />
              {typeof p.rating === "number" && Number.isFinite(p.rating) && p.rating > 0 ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-white/90">
                    {Number.isInteger(p.rating) ? p.rating : Number(p.rating).toFixed(1)}
                  </span>
                  <RatingStars value={p.rating} className="text-[12px]" />
                </div>
              ) : null}
            </div>
            <div className="mt-1 text-sm font-semibold tracking-tight text-white/95 truncate">
              {p.full_name ?? "Profesional"}
            </div>
            {p.headline ? (
              <div className="text-sm text-white/85 line-clamp-2">
                {p.headline}
              </div>
            ) : p.bio ? (
              <div className="text-sm text-white/85 line-clamp-2">
                {p.bio}
              </div>
            ) : (
              <div className="text-sm text-white/85">Sin descripción</div>
            )}
            {(((p.categories?.length ?? 0) + (p.subcategories?.length ?? 0)) > 0) && (
              <div className="mt-1 text-sm text-white/70 line-clamp-2">
                {[...(p.categories ?? []), ...(p.subcategories ?? [])].join(", ")}
              </div>
            )}
            </Link>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        {!showSecondRow && visibleCount < Math.min(items.length, 12) ? (
          <button
            type="button"
            onClick={() => setShowSecondRow(true)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm hover:bg-slate-50"
            aria-label="Mostrar más profesionales"
          >
            ↓
          </button>
        ) : (
          <Link
            href="/professionals"
            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Ver todos
          </Link>
        )}
      </div>
    </div>
  );
}
