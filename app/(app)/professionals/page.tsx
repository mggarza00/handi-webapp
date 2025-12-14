import * as React from "react";
import Link from "next/link";
import { headers } from "next/headers";

import ProfessionalsFiltersAndGrid from "./ProfessionalsFiltersAndGrid.client";

import { CITIES } from "@/lib/cities";

type Pro = {
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
  searchParams?: {
    city?: string;
    category?: string;
    subcategory?: string;
    page?: string;
  };
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
  const items: Pro[] =
    res.ok && Array.isArray(j?.data) ? (j.data as Pro[]) : [];
  const pageSize: number =
    typeof j?.meta?.limit === "number" ? j.meta.limit : 60;
  const total: number =
    typeof j?.meta?.total === "number" ? j.meta.total : items.length;
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
  const hasItems = items.length > 0;

  return (
    <div className="space-y-6 mx-auto max-w-6xl px-4 md:px-6 py-4">
      <h2 className="text-2xl font-semibold">Profesionales</h2>
      <ProfessionalsFiltersAndGrid
        cities={[...CITIES]}
        categories={categoriesList}
        pairs={pairs}
        items={items}
      />
      {hasItems ? (
        <nav
          className="mt-6 flex items-center justify-center gap-2"
          aria-label="Paginación"
        >
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`rounded border px-3 py-1 text-sm ${page <= 1 ? "pointer-events-none text-slate-400 border-slate-200" : "hover:bg-slate-50"}`}
          >
            Anterior
          </Link>
          {Array.from({ length: pageCount })
            .slice(0, 10)
            .map((_, i) => {
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
          {pageCount > 10 && <span className="text-sm text-slate-500">…</span>}
          <Link
            href={pageHref(Math.min(pageCount, page + 1))}
            aria-disabled={page >= pageCount}
            className={`rounded border px-3 py-1 text-sm ${page >= pageCount ? "pointer-events-none text-slate-400 border-slate-200" : "hover:bg-slate-50"}`}
          >
            Siguiente
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
