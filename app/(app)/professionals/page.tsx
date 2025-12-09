import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";

import Filters from "./Filters.client";

import { Card } from "@/components/ui/card";
import { CITIES } from "@/lib/cities";

type Pro = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  rating: number | null;
};

export const dynamic = "force-dynamic";

function getBaseUrl() {
  // Preferir host actual; fallback a envs
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (host ? `${proto}://${host}` : "http://localhost:3000")
  );
}

export default async function Professionals({
  searchParams,
}: {
  searchParams?: { city?: string; category?: string; subcategory?: string; page?: string };
}) {
  const base = getBaseUrl();
  const city = searchParams?.city?.trim() || "";
  const category = searchParams?.category?.trim() || "";
  const subcategory = searchParams?.subcategory?.trim() || "";
  const page = Math.max(1, Number(searchParams?.page || "1"));
  const qs = new URLSearchParams();
  if (city) qs.set("city", city);
  if (category) qs.set("category", category);
  if (subcategory) qs.set("subcategory", subcategory);
  if (page > 1) qs.set("page", String(page));
  const url = `${base}/api/professionals${qs.toString() ? `?${qs.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  });
  const j = await res.json().catch(() => ({ ok: false }));
  const items: Pro[] = res.ok && Array.isArray(j?.data) ? (j.data as Pro[]) : [];
  const pageSize: number = typeof j?.meta?.limit === "number" ? j.meta.limit : 60;
  const total: number = typeof j?.meta?.total === "number" ? j.meta.total : items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(n: number) {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (subcategory) params.set("subcategory", subcategory);
    if (n > 1) params.set("page", String(n));
    const qs2 = params.toString();
    return `/professionals${qs2 ? `?${qs2}` : ""}`;
  }

  // Fetch categories/subcategories for dropdowns
  const catRes = await fetch(`${base}/api/catalog/categories`, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    cache: "no-store",
  });
  const cj = await catRes.json().catch(() => ({ ok: false }));
  const pairs: { category: string; subcategory: string | null }[] =
    catRes.ok && Array.isArray(cj?.data)
      ? (cj.data as { category: string; subcategory: string | null }[])
      : [];
  const categoriesList = Array.from(
    new Set(pairs.map((p) => p.category).filter(Boolean)),
  ).sort();

  return (
    <div className="space-y-6 mx-auto max-w-6xl px-4 md:px-6 py-4">
      <h2 className="text-2xl font-semibold">Profesionales</h2>
      <Filters cities={[...CITIES]} categories={categoriesList} pairs={pairs} />
      {items.length === 0 ? (
        <div className="text-sm text-slate-600">No hay profesionales disponibles.</div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">{items.length} resultados</div>
          <div className="grid md:grid-cols-3 gap-4">
            {items.map((p) => (
              <Link key={p.id} href={`/profiles/${p.id}`} className="block">
                <Card className="hover:bg-slate-50">
                  <div className="flex items-center gap-3 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.avatar_url || "/avatar.png"}
                      alt={p.full_name || "Avatar"}
                      className="h-10 w-10 rounded-full object-cover border"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {p.full_name ?? "Profesional"}
                        </span>
                        {typeof p.rating === "number" && (
                          <span className="text-xs text-amber-600 shrink-0">★ {p.rating.toFixed(1)}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        {p.headline || "Sin descripción"}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {/* Pagination */}
          <nav className="mt-4 flex items-center justify-center gap-2" aria-label="Paginación">
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={`rounded border px-3 py-1 text-sm ${page <= 1 ? "pointer-events-none text-slate-400 border-slate-200" : "hover:bg-slate-50"}`}
            >
              Anterior
            </Link>
            {Array.from({ length: pageCount }).slice(0, 10).map((_, i) => {
              const n = i + 1;
              return (
                <Link
                  key={n}
                  href={pageHref(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`rounded border px-3 py-1 text-sm ${n === page ? "bg-black text-white border-black" : "hover:bg-slate-50"}`}
                >
                  {n}
                </Link>
              );
            })}
            {pageCount > 10 && (
              <span className="text-sm text-slate-500">…</span>
            )}
            <Link
              href={pageHref(Math.min(pageCount, page + 1))}
              aria-disabled={page >= pageCount}
              className={`rounded border px-3 py-1 text-sm ${page >= pageCount ? "pointer-events-none text-slate-400 border-slate-200" : "hover:bg-slate-50"}`}
            >
              Siguiente
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
