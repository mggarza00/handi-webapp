"use server";

import { cookies } from "next/headers";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { createBearerClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export type ExploreFilters = {
  city?: string; // 'Todas'  value
  category?: string; // 'Todas'  value
  subcategory?: string; // 'Todas'  value
  page?: number; // 1-based
  pageSize?: number; // default 20
};

export type ExploreRequestItem = {
  id: string;
  title: string;
  city: string | null;
  category: string | null;
  subcategory?: string | null;
  status: string | null;
  created_at: string | null;
  required_at?: string | null;
  budget?: number | null;
  estimated_budget?: number | null;
  attachments?: unknown;
  is_favorite: boolean;
};

function clean(v?: string | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === "todas" || s === "__ALL__") return null;
  return s;
}

export async function fetchExploreRequests(
  proId: string,
  { page = 1, pageSize = 20, city, category, subcategory }: ExploreFilters,
  client?: SupabaseClient,
): Promise<{
  items: ExploreRequestItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const supabase = client ?? createClient();

  const cCity = clean(city);
  const cCategory = clean(category);
  const cSub = clean(subcategory);

  // Restringir por perfil del profesional (ciudades/categorías)
  let allowedCities: string[] = [];
  let allowedCategories: string[] = [];
  try {
    const { data: prof } = await supabase
      .from("professionals")
      .select("city, cities, categories")
      .eq("id", proId)
      .maybeSingle<{
        city: string | null;
        cities: unknown | null;
        categories: unknown | null;
      }>();
    const citiesArr: string[] = Array.isArray(prof?.cities)
      ? (prof?.cities as unknown[])
          .map((x) => (typeof x === "string" ? x : null))
          .filter((s): s is string => !!s && s.length > 0)
      : [];
    const mainCity =
      prof?.city && typeof prof.city === "string" && prof.city.length > 0
        ? [prof.city]
        : [];
    allowedCities = Array.from(new Set([...(citiesArr || []), ...mainCity]));
    const catsArr: string[] = Array.isArray(prof?.categories)
      ? (prof?.categories as unknown[])
          .map((x) =>
            x && typeof x === "object" && (x as Record<string, unknown>).name
              ? String((x as Record<string, unknown>).name)
              : typeof x === "string"
                ? x
                : null,
          )
          .filter((s): s is string => !!s && s.length > 0)
      : [];
    allowedCategories = Array.from(new Set(catsArr));
  } catch {
    // ignore
  }

  const from = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, pageSize));
  const to = from + Math.max(1, pageSize) - 1;

  const baseQuery = (opts: {
    includeSubcategories: boolean;
    includeSubcategory: boolean;
  }) => {
    const columns = [
      "id",
      "title",
      "city",
      "category",
      "status",
      "created_at",
      "attachments",
      "required_at",
      "estimated_budget:budget",
    ];
    if (opts.includeSubcategory) columns.push("subcategory");
    if (opts.includeSubcategories) columns.push("subcategories");
    return supabase
      .from("requests")
      .select(columns.join(", "), { count: "exact" })
      .eq("status", "active");
  };

  const applyFilters = (
    query: ReturnType<typeof baseQuery>,
    opts: {
      includeJson: boolean;
      includeSubcategory: boolean;
      jsonObjectOnly?: boolean;
      jsonUseContains?: boolean;
    },
  ) => {
    let q = query;
    if (allowedCities.length > 0) q = q.in("city", allowedCities);
    if (allowedCategories.length > 0) q = q.in("category", allowedCategories);
    if (cCity) q = q.eq("city", cCity);
    if (cCategory) q = q.eq("category", cCategory);
    if (cSub) {
      const rawVal = String(cSub);
      if (opts.jsonUseContains) {
        return q.contains("subcategories", [{ name: rawVal }]);
      }
      const eqVal = rawVal.replace(/"/g, '\\"');
      const filters: string[] = [];
      if (opts.includeSubcategory) {
        filters.push(`subcategory.eq."${eqVal}"`);
      }
      if (opts.includeJson) {
        const jsonArr = JSON.stringify([rawVal]); // ["Subcat"]
        const jsonObjArr = JSON.stringify([{ name: rawVal }]); // [{"name":"Subcat"}]
        if (opts.jsonObjectOnly) {
          filters.push(`subcategories.cs.${jsonObjArr}`);
        } else {
          filters.push(`subcategories.cs.${jsonArr}`);
          filters.push(`subcategories.cs.${jsonObjArr}`);
        }
      }
      if (filters.length > 0) {
        q = q.or(filters.join(","));
      }
    }
    return q;
  };

  // Ordenar por fecha requerida (más próximas primero)
  const shouldFallbackSubcategory = (err: PostgrestError | null) => {
    if (!err || !cSub) return false;
    const msg =
      `${err.message || ""} ${err.details || ""} ${err.hint || ""}`.toLowerCase();
    return (
      msg.includes("subcategories") ||
      msg.includes("operator") ||
      msg.includes("invalid input") ||
      msg.includes("does not exist") ||
      msg.includes("cs")
    );
  };

  const isMissingColumn = (err: PostgrestError | null, column: string) => {
    if (!err) return false;
    const msg =
      `${err.message || ""} ${err.details || ""} ${err.hint || ""}`.toLowerCase();
    return msg.includes(column) && msg.includes("does not exist");
  };

  const runQuery = async (opts: {
    includeJson: boolean;
    includeSubcategories: boolean;
    includeSubcategory: boolean;
    jsonObjectOnly?: boolean;
    jsonUseContains?: boolean;
  }) => {
    const q = applyFilters(baseQuery(opts), {
      includeJson: opts.includeJson,
      includeSubcategory: opts.includeSubcategory,
      jsonObjectOnly: opts.jsonObjectOnly,
      jsonUseContains: opts.jsonUseContains,
    }).order("required_at", {
      ascending: true,
      nullsFirst: false,
    });
    return q.range(from, to);
  };

  let data: unknown[] | null = null;
  let count: number | null = null;
  let error: PostgrestError | null = null;

  let subcategoryColumnExists: boolean | null = null;

  ({ data, error, count } = await runQuery({
    includeJson: true,
    includeSubcategories: true,
    includeSubcategory: true,
  }));
  if (error && isMissingColumn(error, "subcategory")) {
    subcategoryColumnExists = false;
    console.error("[explore] subcategory column missing, retrying without it", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(error, {
        tags: { schema: "subcategories_only" },
      });
    } catch {
      /* noop */
    }
    ({ data, error, count } = await runQuery({
      includeJson: true,
      includeSubcategories: true,
      includeSubcategory: false,
    }));
    if (error && shouldFallbackSubcategory(error) && cSub) {
      console.error(
        "[explore] subcategory JSON filter failed, retrying subcategories-only filter",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      );
      ({ data, error, count } = await runQuery({
        includeJson: true,
        includeSubcategories: true,
        includeSubcategory: false,
        jsonObjectOnly: true,
      }));
      if (error && cSub) {
        ({ data, error, count } = await runQuery({
          includeJson: false,
          includeSubcategories: true,
          includeSubcategory: false,
          jsonUseContains: true,
        }));
      }
    }
  } else if (!error) {
    subcategoryColumnExists = true;
  } else if (error && isMissingColumn(error, "subcategories")) {
    console.error(
      "[explore] subcategories column missing, retrying legacy schema",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );
    ({ data, error, count } = await runQuery({
      includeJson: false,
      includeSubcategories: false,
      includeSubcategory: true,
    }));
  } else if (error && shouldFallbackSubcategory(error)) {
    console.error(
      "[explore] subcategory JSON filter failed, retrying legacy filter",
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );
    if (subcategoryColumnExists !== false) {
      ({ data, error, count } = await runQuery({
        includeJson: false,
        includeSubcategories: true,
        includeSubcategory: true,
      }));
      if (error && cSub) {
        ({ data, error, count } = await runQuery({
          includeJson: true,
          includeSubcategories: true,
          includeSubcategory: false,
          jsonObjectOnly: true,
        }));
        if (error && cSub) {
          ({ data, error, count } = await runQuery({
            includeJson: false,
            includeSubcategories: true,
            includeSubcategory: false,
            jsonUseContains: true,
          }));
        }
      }
    } else if (cSub) {
      ({ data, error, count } = await runQuery({
        includeJson: true,
        includeSubcategories: true,
        includeSubcategory: false,
        jsonObjectOnly: true,
      }));
      if (error && cSub) {
        ({ data, error, count } = await runQuery({
          includeJson: false,
          includeSubcategories: true,
          includeSubcategory: false,
          jsonUseContains: true,
        }));
      }
    }
  }
  if (error) {
    console.error("[explore] fetchExploreRequests failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  const rows = (data || []) as Array<Record<string, unknown>>;
  // Lookup favorites separately to avoid dependency on DB relationship
  let favSet = new Set<string>();
  if (rows.length > 0) {
    const ids = rows.map((r) => String(r.id));
    const { data: favRows } = await supabase
      .from("pro_request_favorites")
      .select("request_id")
      .eq("pro_id", proId)
      .in("request_id", ids);
    favSet = new Set(
      (favRows || []).map((fr) =>
        String((fr as { request_id: string }).request_id),
      ),
    );
  }

  const extractSubcategory = (row: Record<string, unknown>) => {
    const direct = (row as { subcategory?: string | null }).subcategory ?? null;
    if (direct) return direct;
    const raw = row.subcategories as unknown;
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0] as { name?: string } | string;
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "name" in first) {
        const name = (first as { name?: string }).name;
        return name ? String(name) : null;
      }
    }
    return null;
  };

  const items: ExploreRequestItem[] = rows.map((r) => {
    return {
      id: String(r.id),
      title: String(r.title ?? "Solicitud"),
      city: (r.city as string | null) ?? null,
      category: (r.category as string | null) ?? null,
      subcategory: extractSubcategory(r),
      status: (r.status as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
      required_at: (r as { required_at?: string | null }).required_at ?? null,
      attachments: r.attachments,
      estimated_budget:
        typeof (r as { estimated_budget?: unknown }).estimated_budget ===
        "number"
          ? ((r as { estimated_budget?: number }).estimated_budget as number)
          : typeof (r as { budget?: unknown }).budget === "number"
            ? ((r as { budget?: number }).budget as number)
            : null,
      budget:
        typeof (r as { estimated_budget?: unknown }).estimated_budget ===
        "number"
          ? ((r as { estimated_budget?: number }).estimated_budget as number)
          : typeof (r as { budget?: unknown }).budget === "number"
            ? ((r as { budget?: number }).budget as number)
            : null,
      is_favorite: favSet.has(String(r.id)),
    };
  });

  // Reordenar favoritos arriba dentro de la página actual
  const ordered = items.slice().sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    const ad = a.required_at || "";
    const bd = b.required_at || "";
    return ad.localeCompare(bd);
  });

  const total = typeof count === "number" ? count : rows.length;
  return {
    items: ordered,
    total,
    page: Math.max(1, page),
    pageSize: Math.max(1, pageSize),
  };
}

export async function toggleFavorite(
  proId: string,
  requestId: string,
  makeFav: boolean,
): Promise<{ ok: boolean; is_favorite: boolean; error?: string }> {
  // Try common cookie names for Supabase access token
  const ck = cookies();
  let token =
    ck.get("sb-access-token")?.value || ck.get("sb:token")?.value || null;
  if (!token) {
    const legacy = ck.get("supabase-auth-token")?.value || "";
    if (legacy) {
      try {
        const parsed = JSON.parse(decodeURIComponent(legacy));
        token =
          parsed?.access_token || parsed?.currentSession?.access_token || null;
      } catch {
        token = null;
      }
    }
  }
  if (!token) {
    return { ok: false, is_favorite: !!makeFav, error: "NO_TOKEN" };
  }
  const supabase = createBearerClient(token);
  if (!proId || !requestId) {
    return { ok: false, is_favorite: false, error: "MISSING_PARAMS" };
  }
  if (makeFav) {
    const { error } = await supabase
      .from("pro_request_favorites")
      .insert({ pro_id: proId, request_id: requestId });
    // Idempotente: ignorar unique violation (23505)
    const isConflict = (error as PostgrestError | null)?.code === "23505";
    if (error && !isConflict) {
      return { ok: false, is_favorite: false, error: error.message };
    }
    return { ok: true, is_favorite: true };
  }
  const { error } = await supabase
    .from("pro_request_favorites")
    .delete()
    .eq("pro_id", proId)
    .eq("request_id", requestId);
  if (error) throw error;
  return { ok: true, is_favorite: false };
}

export default toggleFavorite;
