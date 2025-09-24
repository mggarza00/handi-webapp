// app/requests/_lib/getAvailableProsForRequest.ts
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type DB = Database;

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!url || !key) throw new Error("SERVER_MISCONFIGURED:SUPABASE");
  return createClient<DB>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ProLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  rating: number | null;
};

/**
 * Obtiene profesionales activos para una solicitud.
 * Filtra por categoría/subcategorías/ciudad si están presentes; de lo contrario devuelve activos.
 */
export async function getAvailableProsForRequest(
  requestId: string,
  limit = 20,
): Promise<ProLite[]> {
  const admin = supaAdmin();
  // Cargar datos mínimos de la request
  const { data: req } = await admin
    .from("requests")
    .select("id, category, subcategories, city")
    .eq("id", requestId)
    .maybeSingle<{
      id: string;
      category?: string | null;
      subcategories?: unknown;
      city?: string | null;
    }>();

  const wantedCategory = (req?.category ?? null) as string | null;
  const wantedCity = (req?.city ?? null) as string | null;

  const toArray = (v: unknown): string[] => {
    if (Array.isArray(v)) {
      return v
        .map((x) => (typeof x === "string" ? x : (x as { name?: string })?.name))
        .filter((s): s is string => typeof s === "string" && s.length > 0);
    }
    if (typeof v === "string") {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed)
          ? parsed
              .map((x) => (typeof x === "string" ? x : (x as { name?: string })?.name))
              .filter((s): s is string => typeof s === "string" && s.length > 0)
          : [];
      } catch {
        return v.includes(",") ? v.split(",").map((s) => s.trim()).filter(Boolean) : v ? [v] : [];
      }
    }
    return [];
  };

  const wantedSubs = toArray(req?.subcategories ?? []);

  // Traer profesionales activos
  let q = admin
    .from("professionals_with_profile")
    .select(
      "id, full_name, avatar_url, headline, rating, active, city, categories, subcategories",
    )
    .or("active.is.true,active.is.null")
    .order("is_featured", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("last_active_at", { ascending: false, nullsFirst: false })
    .limit(500);

  // Filtros opcionales
  if (wantedCity) q = q.eq("city", wantedCity);
  if (wantedCategory) q = q.contains("categories", [wantedCategory]);
  if (wantedSubs.length) q = q.overlaps("subcategories", wantedSubs);

  const { data, error } = await q;
  if (error || !data) return [];

  const mapped = (data as unknown[])
    .map((r) => r as Record<string, unknown>)
    .map((x) => ({
      id: String(x.id ?? ""),
      full_name: (x.full_name as string | null) ?? null,
      avatar_url: (x.avatar_url as string | null) ?? null,
      headline: (x.headline as string | null) ?? null,
      rating: typeof x.rating === "number" ? (x.rating as number) : null,
    }))
    .filter((p) => p.id)
    .slice(0, limit);

  return mapped;
}
