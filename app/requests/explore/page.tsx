import { headers } from "next/headers";
import Link from "next/link";
import createClient from "@/utils/supabase/server";

import ExploreFilters from "@/app/requests/explore/ExploreFilters.client";
import Pagination from "@/components/explore/Pagination";
import RequestsList from "@/components/explore/RequestsList.client";
import { fetchExploreRequests } from "@/lib/db/requests";

type RequestRow = {
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

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (host ? `${proto}://${host}` : "http://localhost:3000")
  );
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return;
    sp.set(k, String(v));
  });
  return sp.toString();
}

export default async function ExploreRequestsPage({
  searchParams,
}: {
  searchParams?: { page?: string; city?: string; category?: string; subcategory?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold mb-2">Trabajos disponibles</h1>
        <p className="text-sm text-slate-700">
          Inicia sesión para ver solicitudes compatibles con tu perfil.
        </p>
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-brand px-3 py-2 text-white hover:opacity-90"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("professionals")
    .select("city, cities, categories, subcategories")
    .eq("id", user.id)
    .maybeSingle<{
      city: string | null;
      cities: string[] | null;
      // categories stored as array of { name } objects
      categories: Array<{ name?: string } | string> | null;
      subcategories?: Array<{ name?: string } | string> | null;
    }>();

  const cities = Array.isArray(profile?.cities)
    ? (profile?.cities as unknown[])
        .map((x) => (typeof x === "string" ? x : null))
        .filter((s): s is string => !!s && s.length > 0)
    : [];
  const mainCity =
    typeof profile?.city === "string" && profile.city.length > 0
      ? [profile.city]
      : [];
  const allCities = Array.from(new Set([...cities, ...mainCity]));

  const categoryNames = Array.isArray(profile?.categories)
    ? (profile?.categories as unknown[])
        .map((x) =>
          x && typeof x === "object" && (x as Record<string, unknown>).name
            ? String((x as Record<string, unknown>).name)
            : null,
        )
        .filter((s): s is string => !!s && s.length > 0)
    : [];

  const subcategoryNames = Array.isArray(profile?.subcategories)
    ? (profile?.subcategories as unknown[])
        .map((x) =>
          x && typeof x === "object" && (x as Record<string, unknown>).name
            ? String((x as Record<string, unknown>).name)
            : typeof x === "string"
              ? x
              : null,
        )
        .filter((s): s is string => !!s && s.length > 0)
    : [];

  // Requerimos ciudades y categorías. Las subcategorías afinan resultados si existen.
  const hasFilters = allCities.length > 0 && categoryNames.length > 0;

  if (!hasFilters) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold mb-2">Trabajos disponibles</h1>
        <div className="rounded-2xl border p-4">
          <p className="font-medium">Completa tu perfil profesional</p>
          <p className="text-sm text-slate-600 mt-1">
            Para ver solicitudes compatibles, configura tus ciudades y categorías.
          </p>
          <div className="mt-3">
            <Link
              href="/profile/setup"
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Configurar mi perfil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // URL params with defaults (SSR state)
  const paramCity = (searchParams?.city ?? "Todas").trim();
  const paramCategory = (searchParams?.category ?? "Todas").trim();
  const paramSubcategory = (searchParams?.subcategory ?? "Todas").trim();
  const page = Math.max(1, Number(searchParams?.page || "1"));

  // Catálogo oficial desde Supabase: categories_subcategories
  const base = getBaseUrl();
  // Forward raw cookies for SSR fetch
  const ck = headers();
  const cookie = ck.get("cookie");
  let catalogPairs: Array<{ category: string; subcategory: string | null }> = [];
  try {
    const res = await fetch(`${base}/api/catalog/categories`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cookie ? { cookie } : {}),
      },
      cache: "no-store",
    });
    const j = await res.json().catch(() => null as any);
    if (res.ok && j?.ok && Array.isArray(j.data)) {
      catalogPairs = j.data.map((r: any) => ({
        category: String(r.category || "").trim(),
        subcategory: (r.subcategory ? String(r.subcategory) : "").trim() || null,
      }));
    }
  } catch {
    /* ignore */
  }

  // Filtrar catálogo a las categorías/subcategorías activas del profesional
  const filteredPairs = catalogPairs.filter((p) => {
    const inCategory = categoryNames.includes(p.category);
    if (!inCategory) return false;
    // Si el profesional no tiene subcategorías declaradas, no ofrecemos ninguna subcategoría
    if (!subcategoryNames || subcategoryNames.length === 0) return false;
    // Mantener sólo subcategorías activas para ese profesional
    return !!p.subcategory && subcategoryNames.includes(p.subcategory);
  });

  // Fetch results via util (DB-level paginate and favorites join)
  const { items, total, page: safePage, pageSize } = await fetchExploreRequests(user.id, {
    city: paramCity,
    category: paramCategory,
    subcategory: paramSubcategory,
    page,
    pageSize: PER_PAGE,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="mb-1">
        <h1 className="text-2xl font-semibold">Trabajos disponibles</h1>
        <p className="text-xs text-slate-600 mt-1">
          {allCities.join(", ")} · Categorías: {categoryNames.join(", ")}
        </p>
      </div>

      <ExploreFilters
        // Ciudades: sólo las del profesional (incluyendo su ciudad principal)
        cities={allCities}
        // Categorías: sólo las activas del profesional
        categories={categoryNames}
        // Pairs restringidos a subcategorías activas del profesional
        pairs={filteredPairs}
        selected={{
          city: paramCity,
          category: paramCategory,
          subcategory: paramSubcategory,
          page: String(page),
        }}
      />

      <RequestsList proId={user.id} initialItems={items} />

      <Pagination page={safePage} pageSize={pageSize} total={total} />
    </div>
  );
}
