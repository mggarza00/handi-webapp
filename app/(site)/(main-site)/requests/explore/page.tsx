import { headers } from "next/headers";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import ExploreFilters from "@/app/(site)/(main-site)/requests/explore/ExploreFilters.client";
import Pagination from "@/components/explore/Pagination";
import RequestsList from "@/components/explore/RequestsList.client";
import { fetchExploreRequests } from "@/lib/db/requests";
import { getAdminSupabase } from "@/lib/supabase/admin";
import getServerClient from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

type CatalogApiRow = {
  category?: string | null;
  subcategory?: string | null;
  icon?: string | null;
  color?: string | null;
};

type CatalogResponse = {
  ok?: boolean;
  data: CatalogApiRow[];
};

type CatalogPair = {
  category: string;
  subcategory: string | null;
  icon?: string | null;
  color?: string | null;
};

type ExploreSort = "recent" | "budget_desc" | "category_asc";

function parseSort(value?: string): ExploreSort {
  if (value === "budget_desc") return "budget_desc";
  if (value === "category_asc") return "category_asc";
  return "recent";
}

function normalizeCatalogKey(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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
    return ["category", "subcategory", "icon", "color"].every(validateField);
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
  searchParams?: {
    page?: string;
    city?: string;
    category?: string;
    subcategory?: string;
    sort?: string;
  };
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

  // URL params with defaults (SSR state)
  const paramCity = (searchParams?.city ?? "").trim();
  const paramCategory = (searchParams?.category ?? "").trim();
  const paramSubcategory = (searchParams?.subcategory ?? "").trim();
  const paramSort = parseSort((searchParams?.sort ?? "recent").trim());
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
        subcategory:
          (row.subcategory ? String(row.subcategory) : "").trim() || null,
        icon: (row.icon ? String(row.icon) : "").trim() || null,
        color: (row.color ? String(row.color) : "").trim() || null,
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
  const allowedCatalogCategories = Array.from(
    new Set(filteredPairs.map((p) => p.category).filter(Boolean)),
  );

  // Requerimos ciudades y categorías derivadas del catálogo oficial permitido.
  const hasFilters =
    allCities.length > 0 && allowedCatalogCategories.length > 0;

  if (!hasFilters) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold mb-2">Trabajos disponibles</h1>
        <div className="rounded-2xl border p-4">
          <p className="font-medium">Completa tu perfil profesional</p>
          <p className="text-sm text-slate-600 mt-1">
            Para ver solicitudes compatibles, configura tus ciudades y
            categorías.
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

  // Fetch results via util (DB-level paginate and favorites join)
  let items: Awaited<ReturnType<typeof fetchExploreRequests>>["items"] = [];
  let total = 0;
  let safePage = page;
  let pageSize = PER_PAGE;
  let loadError = false;
  try {
    const result = await fetchExploreRequests(user.id, {
      city: paramCity,
      category: paramCategory,
      subcategory: paramSubcategory,
      sort: paramSort,
      page,
      pageSize: PER_PAGE,
    });
    ({ items, total, page: safePage, pageSize } = result);
  } catch (err) {
    const error = err as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    console.error("[explore] failed to load requests", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    Sentry.captureException(error, {
      tags: {
        route: "/requests/explore",
      },
      user: { id: user.id },
      extra: {
        city: paramCity,
        category: paramCategory,
        subcategory: paramSubcategory,
      },
    });
    loadError = true;
  }

  // Resolve client profile fields with service role (RLS-safe fallback).
  const createdByIds = Array.from(
    new Set(
      items
        .map((item) => item.created_by)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const clientById = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();
  if (createdByIds.length > 0) {
    try {
      const admin = getAdminSupabase();
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", createdByIds);
      const rows = (profiles || []) as Array<{
        id?: string | null;
        full_name?: string | null;
        avatar_url?: string | null;
      }>;
      for (const profile of rows) {
        if (!profile?.id) continue;
        clientById.set(String(profile.id), {
          full_name: profile.full_name ?? null,
          avatar_url: profile.avatar_url ?? null,
        });
      }
    } catch {
      // Keep null fallbacks when service role is unavailable.
    }
  }

  const enrichedItems = items.map((item) => {
    const profile = item.created_by ? clientById.get(item.created_by) : null;
    return {
      ...item,
      client_name: profile?.full_name ?? null,
      client_avatar_url: profile?.avatar_url ?? null,
    };
  });

  // Build subcategory -> icon map for cards (lowercased key)
  const subcategoryIconMap: Record<string, string> = Object.fromEntries(
    (catalogPairs || [])
      .filter(
        (p) =>
          typeof p.subcategory === "string" &&
          !!p.subcategory &&
          typeof p.icon === "string" &&
          !!p.icon,
      )
      .map((p) => [normalizeCatalogKey(String(p.subcategory)), String(p.icon)]),
  );
  const categoryIconMap: Record<string, string> = Object.fromEntries(
    (catalogPairs || [])
      .filter(
        (p) =>
          typeof p.category === "string" &&
          !!p.category &&
          typeof p.icon === "string" &&
          !!p.icon,
      )
      .map((p) => [normalizeCatalogKey(String(p.category)), String(p.icon)]),
  );
  const subcategoryColorMap: Record<string, string> = Object.fromEntries(
    (catalogPairs || [])
      .filter(
        (p) =>
          typeof p.subcategory === "string" &&
          !!p.subcategory &&
          typeof p.color === "string" &&
          !!p.color,
      )
      .map((p) => [
        normalizeCatalogKey(String(p.subcategory)),
        String(p.color),
      ]),
  );
  const categoryColorMap: Record<string, string> = Object.fromEntries(
    (catalogPairs || [])
      .filter(
        (p) =>
          typeof p.category === "string" &&
          !!p.category &&
          typeof p.color === "string" &&
          !!p.color,
      )
      .map((p) => [normalizeCatalogKey(String(p.category)), String(p.color)]),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="mb-1">
        <h1 className="text-2xl font-semibold">Trabajos disponibles</h1>
      </div>

      <ExploreFilters
        // Ciudades: sólo las del profesional (incluyendo su ciudad principal)
        cities={allCities}
        // Categorías: derivadas del catálogo oficial permitido al profesional
        categories={allowedCatalogCategories}
        // Pairs restringidos a subcategorías activas del profesional
        pairs={filteredPairs}
        selected={{
          city: paramCity,
          category: paramCategory,
          subcategory: paramSubcategory,
          sort: paramSort,
          page: String(page),
        }}
      />

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No pudimos cargar trabajos en este momento. Intenta recargar en unos
          segundos.
        </div>
      ) : null}

      <RequestsList
        proId={user.id}
        initialItems={enrichedItems}
        sort={paramSort}
        subcategoryIconMap={subcategoryIconMap}
        categoryIconMap={categoryIconMap}
        subcategoryColorMap={subcategoryColorMap}
        categoryColorMap={categoryColorMap}
      />

      <Pagination page={safePage} pageSize={pageSize} total={total} />
    </div>
  );
}
