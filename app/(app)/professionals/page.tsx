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
        </div>
      )}
    </div>
  );
}
