import { cookies, headers } from "next/headers";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import FiltersBar from "@/components/explore/FiltersBar";
import Pagination from "@/components/explore/Pagination";
import RequestsList from "@/components/explore/RequestsList.client";
import { fetchExploreRequests } from "@/lib/db/requests";
import getDistinct from "@/lib/db/get-distinct";

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
  const supabase = createServerComponentClient<Database>({ cookies });
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

  // Opciones de selects (desde BD)
  const cityOptions = await getDistinct("requests", "city");
  const categoryOptions = await getDistinct("requests", "category");
  const subcategoryOptions = await getDistinct("requests", "subcategory");

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

      <FiltersBar cityOptions={cityOptions} categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions} />

      <RequestsList proId={user.id} initialItems={items} />

      <Pagination page={safePage} pageSize={pageSize} total={total} />
    </div>
  );
}
