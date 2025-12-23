import { headers } from "next/headers";
import Link from "next/link";

import ExploreFilters from "@/app/(site)/(main-site)/requests/explore/ExploreFilters.client";
import Pagination from "@/components/explore/Pagination";
import RequestsList from "@/components/explore/RequestsList.client";
import { fetchExploreRequests } from "@/lib/db/requests";
import getServerClient from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

type CatalogApiRow = {
  category?: string | null;
  subcategory?: string | null;
  icon?: string | null;
};

type CatalogResponse = {
  ok?: boolean;
  data: CatalogApiRow[];
};

type CatalogPair = {
  category: string;
  subcategory: string | null;
  icon?: string | null;
};

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

function parseCatalogResponse(payload: unknown): CatalogResponse | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidateData = (payload as { data?: unknown }).data;
  if (!Array.isArray(candidateData)) {
    return null;
  }

  const isValidRow = (value: unknown): value is CatalogApiRow => {
    if (!value || typeof value !== "object") {
      return false;
    }
    const row = value as Record<string, unknown>;
    const validateField = (key: string) =>
      !(key in row) || typeof row[key] === "string" || row[key] == null;
    return ["category", "subcategory", "icon"].every(validateField);
  };

  if (!candidateData.every(isValidRow)) {
    return null;
  }

  return {
    ok: (payload as { ok?: boolean }).ok,
    data: candidateData,
  };
}

export default async function ExploreRequestsPage({
  searchParams,
}: {
  searchParams?: { page?: string; city?: string; category?: string; subcategory?: string };
}) {
  const supabase = getServerClient();
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
  let catalogPairs: CatalogPair[] = [];
  try {
    const res = await fetch(`${base}/api/catalog/categories`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(cookie ? { cookie } : {}),
      },
      cache: "no-store",
    });
    const parsed = parseCatalogResponse(await res.json().catch(() => null));
    if (res.ok && parsed?.ok && Array.isArray(parsed.data)) {
      catalogPairs = parsed.data.map((row) => ({
        category: String(row.category || "").trim(),
        subcategory: (row.subcategory ? String(row.subcategory) : "").trim() || null,
        icon: (row.icon ? String(row.icon) : "").trim() || null,
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

  // Build subcategory -> icon map for cards (lowercased key)
  const subcategoryIconMap: Record<string, string> = Object.fromEntries(
    (catalogPairs || [])
      .filter((p) => typeof p.subcategory === "string" && !!p.subcategory && typeof p.icon === "string" && !!p.icon)
      .map((p) => [String(p.subcategory).toLowerCase(), String(p.icon)])
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="mb-1">
        <h1 className="text-2xl font-semibold">Trabajos disponibles</h1>
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

      <RequestsList proId={user.id} initialItems={items} subcategoryIconMap={subcategoryIconMap} />

      <Pagination page={safePage} pageSize={pageSize} total={total} />
    </div>
  );
}
