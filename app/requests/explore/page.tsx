import { cookies } from "next/headers";
import Link from "next/link";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/supabase";
import { filterExplorableRequests } from "./_lib/filter";

type RequestRow = {
  id: string;
  title: string;
  city: string | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
  attachments?: unknown;
};

const DEFAULT_REQUEST_IMAGE = "/images/default-requests-image.png";

export const dynamic = "force-dynamic";

export default async function ExploreRequestsPage() {
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
  const allCities = Array.from(new Set([...
    cities,
    ...mainCity,
  ]));

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

  // Query de solicitudes activas en las ciudades y categorías del profesional
  let query = supabase
    .from("requests")
    .select(
      "id, title, city, category, status, created_at, attachments, subcategories",
    )
    .eq("status", "active")
    // Refuerzo: excluir elementos marcados como no explorables si existen estas columnas
    .is("is_explorable" as any, true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (allCities.length > 0) query = query.in("city", allCities);
  if (categoryNames.length > 0) query = query.in("category", categoryNames);

  const { data: rows, error } = await query;
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold mb-2">Trabajos disponibles</h1>
        <p className="text-sm text-red-600">Error: {error.message}</p>
      </div>
    );
  }

  // Filtrar por subcategorías (intersección) solo si el profesional configuró subcategorías
  // Defensa adicional: aplicar filtro por status e is_explorable a nivel UI
  const prefiltered = filterExplorableRequests(((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    ...(r as Record<string, unknown>),
    status: (r as Record<string, unknown>).status as string | null,
    is_explorable: (r as Record<string, unknown>).is_explorable as boolean | null,
    visible_in_explore: (r as Record<string, unknown>).visible_in_explore as boolean | null,
    id: String((r as Record<string, unknown>).id ?? ""),
  })) as any) as unknown as Array<Record<string, unknown>>;

  const items: RequestRow[] = (prefiltered as Array<Record<string, unknown>>)
    .filter((r) => {
      if (subcategoryNames.length === 0) return true; // sin filtro por subcategoría
      const subs = r.subcategories as unknown;
      const names: string[] = Array.isArray(subs)
        ? subs
            .map((x) =>
              x && typeof x === "object" && (x as Record<string, unknown>).name
                ? String((x as Record<string, unknown>).name)
                : typeof x === "string"
                  ? x
                  : null,
            )
            .filter((s): s is string => !!s && s.length > 0)
        : [];
      if (names.length === 0) return false; // la solicitud no tiene subcategorías
      return names.some((n) => subcategoryNames.includes(n));
    }) as unknown as RequestRow[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold">Trabajos disponibles</h1>
        <p className="text-xs text-slate-600 mt-1">
          {allCities.join(", ")} · Categorías: {categoryNames.join(", ")}
        </p>
      </div>

      <ul className="space-y-3 mt-3">
        {items.length > 0 ? (
          items.map((it) => {
            let thumb: string | null = null;
            const atts = (it as { attachments?: unknown }).attachments as unknown;
            if (Array.isArray(atts)) {
              const first = atts.find(
                (a) => a && typeof a === "object" && (a as Record<string, unknown>).url,
              );
              if (first) {
                const rawUrl = (first as Record<string, unknown>).url;
                thumb = typeof rawUrl === "string" ? rawUrl.trim() : String(rawUrl ?? "");
              }
            }
            const thumbSrc = thumb && thumb.length > 0 ? thumb : DEFAULT_REQUEST_IMAGE;
            return (
              <li key={it.id}>
                <a href={`/requests/explore/${it.id}`} className="block">
                  <div className="rounded-2xl border p-3 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbSrc}
                        alt={it.title}
                        className="h-16 w-16 rounded-md object-cover border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{it.title}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {it.city ?? "—"} · {it.status ?? "active"} · {it.created_at?.slice(0, 10) ?? ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </a>
              </li>
            );
          })
        ) : (
          <li className="p-3 text-sm text-gray-600">
            <div className="rounded-2xl border p-4">
              <p className="font-medium">No encontramos solicitudes para tus filtros</p>
              <p className="text-xs text-slate-600 mt-1">
                Prueba ampliando tus ciudades o categorías en tu perfil.
              </p>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
