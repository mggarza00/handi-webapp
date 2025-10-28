"use client";

import * as React from "react";
import Link from "next/link";
import { CirclePlus, Star } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ExploreItem = {
  id: string;
  title: string;
  city: string | null;
  category: string | null;
  subcategory?: string | null;
  status: string | null;
  created_at: string | null;
  budget?: number | null;
  attachments?: unknown;
};

const DEFAULT_REQUEST_IMAGE = "/images/default-requests-image.png";

function formatCurrencyMXN(n?: number | null): string | null {
  if (typeof n !== "number") return null;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

function extractThumb(att?: unknown): string | null {
  if (!att) return null;
  const a = att as unknown[];
  if (Array.isArray(a)) {
    const first = a.find((x) => x && typeof x === "object" && (x as Record<string, unknown>).url);
    if (first) {
      const raw = (first as Record<string, unknown>).url as unknown;
      const s = typeof raw === "string" ? raw : String(raw ?? "");
      return s.trim().length > 0 ? s.trim() : null;
    }
  }
  return null;
}

export default function ExploreList({ items }: { items: ExploreItem[] }) {
  const [favs, setFavs] = React.useState<Set<string>>(new Set());

  const ordered = React.useMemo(() => {
    const order = new Map(items.map((it, i) => [it.id, i]));
    return items.slice().sort((a, b) => {
      const af = favs.has(a.id) ? 0 : 1;
      const bf = favs.has(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return (order.get(a.id) || 0) - (order.get(b.id) || 0);
    });
  }, [items, favs]);

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <ul className="space-y-3 mt-3">
        <li className="p-3 text-sm text-gray-600">
          <div className="rounded-2xl border p-4">
            <p className="font-medium">No encontramos solicitudes para tus filtros</p>
            <p className="text-xs text-slate-600 mt-1">
              Prueba ajustando ciudad, categoría o subcategoría.
            </p>
          </div>
        </li>
      </ul>
    );
  }

  return (
    <ul className="space-y-3 mt-3">
      {ordered.map((it) => {
        const thumb = extractThumb(it.attachments) || DEFAULT_REQUEST_IMAGE;
        const budget = formatCurrencyMXN(it.budget ?? null);
        const created = it.created_at ? String(it.created_at).slice(0, 10) : "";
        const isFav = favs.has(it.id);
        return (
          <li key={it.id}>
            <div className="rounded-2xl border p-3 hover:bg-slate-50 transition">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt={it.title}
                  className="h-16 w-16 rounded-md object-cover border"
                />
                <div className="flex-1 min-w-0">
                  <Link href={`/requests/explore/${it.id}`} className="block">
                    <p className="font-medium truncate text-slate-900">{it.title}</p>
                    <div className="text-xs text-gray-600 flex items-center justify-between gap-3">
                      <span className="truncate">
                        {it.city ?? "—"} · {created}
                      </span>
                      {budget ? (
                        <span className="shrink-0 text-slate-900">{budget}</span>
                      ) : (
                        <span className="shrink-0 text-slate-400">—</span>
                      )}
                    </div>
                  </Link>
                </div>
                <div className="shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-pressed={isFav}
                        aria-label={isFav ? "Favorito" : "Agregar a favoritos"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFav(it.id);
                        }}
                        className={[
                          "inline-flex items-center justify-center rounded-full border size-8",
                          isFav
                            ? "text-yellow-600 border-yellow-500 bg-yellow-50"
                            : "text-slate-500 border-slate-300 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        {isFav ? (
                          <Star className="size-5" />
                        ) : (
                          <CirclePlus className="size-5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{isFav ? "Favorito" : "Agregar a favoritos"}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
