/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

import { getProfessionalRatingSummary } from "@/lib/professionals/ratings";

// Supabase generics intentionally relaxed to reduce type instantiation costs.

type ProfileOverviewPro = {
  [key: string]: unknown;
  profiles?: Record<string, unknown> | null;
};

export type ColoredTag = {
  name: string;
  type: "category" | "subcategory";
  bgColor?: string | null;
  textColor?: string | null;
  borderColor?: string | null;
};

export type ProfileOverview = {
  // Prefer professionals + join profiles (según guía); si no existe el join, usar profesionales_* view como fallback
  pro: ProfileOverviewPro | null;
  averageRating: number | null;
  ratingCount: number;
  jobsDone: number;
  categories: string[];
  subcategories: string[];
  cities: string[];
  coloredTags: ColoredTag[];
};

export async function getProfessionalOverview(
  supa: SupabaseClient<any>,
  id: string,
): Promise<ProfileOverview> {
  const supaClient = supa as any;
  // Perfil + métricas
  // Intento 1: tabla professionals + join a profiles (según guía)
  let pro: ProfileOverview["pro"] = null;
  const sel: any = await supaClient
    .from("professionals")
    .select(
      `
      id,
      user_id,         -- TODO(schema): si no existe en este esquema, usar id directamente
      full_name,
      avatar_url,
      years_experience,
      bio,
      city,
      rating,
      is_featured,
      certifications,  -- TODO(schema): si no existe, omitir o mapear a la columna real
      main_categories, -- TODO(schema): si no existe, omitir
      categories,
      subcategories,
      verified,        -- TODO(schema): si no existe, derivar de is_featured
      cities,
      profiles:profiles!inner(
        full_name,
        first_name,
        last_name,
        name,
        display_name,
        avatar_url,
        city,
        state,
        country,
        cities
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (sel && sel.data) {
    pro = sel.data as any;
  } else {
    // Fallback: usar vista professionals_with_profile o tabla professionals con campos in-line
    const alt = await supaClient
      .from("professionals_with_profile")
      .select(
        "id, full_name, avatar_url, bio, years_experience, city, cities, categories, subcategories, is_featured",
      )
      .eq("id", id)
      .maybeSingle();
    if (alt && alt.data) {
      const row = alt.data as any;
      pro = {
        id: row.id,
        full_name: row.full_name ?? null,
        avatar_url: row.avatar_url ?? null,
        years_experience: row.years_experience,
        bio: row.bio,
        city: row.city ?? null,
        rating: row.rating ?? null,
        is_featured: row.is_featured ?? null,
        verified: row.is_featured ?? null, // aproximación
        profiles: {
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          city: row.city,
          state: null,
          country: null,
        },
        main_categories: row.categories ?? row.subcategories ?? null,
        categories: row.categories ?? null,
        subcategories: row.subcategories ?? null,
        cities: row.cities ?? null,
      } as any;
    }
  }

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const asTrimmedString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };
  const resolveNameFromRecord = (
    record: Record<string, unknown> | null | undefined,
  ): string | null => {
    if (!record) return null;
    const direct =
      asTrimmedString(record.full_name) ??
      asTrimmedString(record.display_name) ??
      asTrimmedString(record.name);
    if (direct) return direct;
    const first = asTrimmedString(record.first_name);
    const last = asTrimmedString(record.last_name);
    if (first && last) return `${first} ${last}`;
    return first ?? last ?? null;
  };

  if (pro) {
    const proRecord = asRecord(pro) ?? {};
    const profilesValue = proRecord.profiles;
    let profileRecord = Array.isArray(profilesValue)
      ? asRecord(profilesValue[0])
      : asRecord(profilesValue);

    const currentName =
      resolveNameFromRecord(profileRecord) ?? resolveNameFromRecord(proRecord);
    const currentAvatar =
      asTrimmedString(profileRecord?.avatar_url) ??
      asTrimmedString(proRecord.avatar_url);

    if (!profileRecord || !currentName || !currentAvatar) {
      const candidateIds = Array.from(
        new Set(
          [proRecord.user_id, proRecord.id, id]
            .map((candidate) => asTrimmedString(candidate))
            .filter((candidate): candidate is string => Boolean(candidate)),
        ),
      );
      for (const candidateId of candidateIds) {
        const profileRes = await supaClient
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", candidateId)
          .maybeSingle();
        if (!profileRes.error && profileRes.data) {
          profileRecord = asRecord(profileRes.data);
          break;
        }
      }
    }

    if (profileRecord) {
      proRecord.profiles = profileRecord;
      const resolvedName = resolveNameFromRecord(profileRecord);
      if (!resolveNameFromRecord(proRecord) && resolvedName) {
        proRecord.full_name = resolvedName;
      }
      if (
        !asTrimmedString(proRecord.avatar_url) &&
        asTrimmedString(profileRecord.avatar_url)
      ) {
        proRecord.avatar_url = profileRecord.avatar_url;
      }
      if (
        !asTrimmedString(proRecord.city) &&
        asTrimmedString(profileRecord.city)
      ) {
        proRecord.city = profileRecord.city;
      }
    }

    pro = proRecord as any;
  }

  // ratings agregados (alineado con getReviews: preferir ratings.to_user_id)
  let ratingRows: Array<{ stars: number | null }> = [];
  let ratingCount = 0;
  const r1 = await supaClient
    .from("ratings")
    .select("stars", { head: false, count: "exact" })
    .eq("to_user_id", id);
  if (!r1.error) {
    ratingRows = (r1.data as any[]) || [];
    ratingCount = r1.count ?? ratingRows.length;
  } else {
    const r2 = await supaClient
      .from("ratings")
      .select("stars", { head: false, count: "exact" })
      .eq("professional_id" as any, id); // TODO(schema): fallback si no existe to_user_id
    ratingRows = (r2.data as any[]) || [];
    ratingCount = r2.count ?? ratingRows.length;
  }
  const averageRating = ratingCount
    ? ratingRows.reduce((a, b) => a + (Number(b?.stars ?? 0) || 0), 0) /
      ratingCount
    : null;

  // trabajos finalizados (preferido: requests por professional_id y estado)
  let jobsDone = 0;
  const j1 = await supaClient
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("professional_id" as any, id) // TODO(schema): si no existe, usar agreements como fallback
    .in("status", ["finalizada", "completed", "finished"]);
  if (!j1.error) {
    jobsDone = j1.count ?? 0;
  } else {
    const j2 = await supaClient
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", id)
      .eq("status", "completed");
    jobsDone = j2.count ?? 0;
  }

  const parseNamesArray = (input: string): unknown[] | string | null => {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed as unknown[];
      if (typeof parsed === "string") return parsed;
      return null;
    } catch {
      return null;
    }
  };
  const fromCommaSeparated = (value: string): string[] =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const toNames = (v: unknown): string[] => {
    const visit = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap((item) => visit(item));
      if (typeof value === "string") {
        const s = value.trim();
        if (!s) return [];
        const parsed = parseNamesArray(s);
        if (parsed !== null) return visit(parsed);
        return s.includes(",") ? fromCommaSeparated(s) : [s];
      }
      if (value && typeof value === "object") {
        const name = (value as { name?: unknown }).name;
        return typeof name === "string" ? visit(name) : [];
      }
      return [];
    };
    return Array.from(
      new Set(
        visit(v)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  };

  const categories = toNames(
    (pro as any)?.main_categories ?? (pro as any)?.categories,
  );
  const subcategories = toNames((pro as any)?.subcategories);
  const cities = toNames(
    (pro as any)?.cities ?? (pro as any)?.profiles?.cities,
  );
  const normalizeKey = (value: string): string =>
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const toStringOrNull = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };
  const pickFirstString = (
    row: Record<string, unknown>,
    keys: string[],
  ): string | null => {
    for (const key of keys) {
      const value = toStringOrNull(row[key]);
      if (value) return value;
    }
    return null;
  };
  const buildMetaMap = (
    rows: Array<Record<string, unknown>>,
    nameKeys: string[],
  ): Map<
    string,
    {
      bgColor: string | null;
      textColor: string | null;
      borderColor: string | null;
    }
  > => {
    const map = new Map<
      string,
      {
        bgColor: string | null;
        textColor: string | null;
        borderColor: string | null;
      }
    >();
    for (const row of rows) {
      const name = pickFirstString(row, nameKeys);
      if (!name) continue;
      const key = normalizeKey(name);
      if (!key || map.has(key)) continue;
      const bgColor = pickFirstString(row, [
        "color",
        "color_hex",
        "hex_color",
        "bg_color",
        "background_color",
      ]);
      const textColor = pickFirstString(row, [
        "text_color",
        "font_color",
        "label_color",
      ]);
      const borderColor = pickFirstString(row, [
        "border_color",
        "stroke_color",
        "outline_color",
      ]);
      map.set(key, { bgColor, textColor, borderColor });
    }
    return map;
  };
  const withFallback = (
    item:
      | {
          bgColor: string | null;
          textColor: string | null;
          borderColor: string | null;
        }
      | undefined,
  ): {
    bgColor?: string | null;
    textColor?: string | null;
    borderColor?: string | null;
  } => ({
    bgColor: item?.bgColor ?? null,
    textColor: item?.textColor ?? null,
    borderColor: item?.borderColor ?? null,
  });

  let categoryMetaRows: Array<Record<string, unknown>> = [];
  let subcategoryMetaRows: Array<Record<string, unknown>> = [];
  try {
    const catalogRes = await supaClient
      .from("categories_subcategories")
      .select("*");
    const catalogRows = Array.isArray(catalogRes?.data)
      ? (catalogRes.data as Array<Record<string, unknown>>)
      : [];
    categoryMetaRows = catalogRows;
    subcategoryMetaRows = catalogRows;
  } catch {
    categoryMetaRows = [];
    subcategoryMetaRows = [];
  }

  const categoryMetaMap = buildMetaMap(categoryMetaRows, [
    "category",
    "name",
    "label",
    "Categoria",
    "Categoría",
  ]);
  const subcategoryMetaMap = buildMetaMap(subcategoryMetaRows, [
    "subcategory",
    "sub_category",
    "name",
    "label",
    "Subcategoria",
    "Subcategoría",
  ]);

  const coloredTags: ColoredTag[] = [
    ...categories.map((name) => ({
      name,
      type: "category" as const,
      ...withFallback(categoryMetaMap.get(normalizeKey(name))),
    })),
    ...subcategories.map((name) => ({
      name,
      type: "subcategory" as const,
      ...withFallback(subcategoryMetaMap.get(normalizeKey(name))),
    })),
  ];

  return {
    pro,
    averageRating,
    ratingCount,
    jobsDone,
    categories,
    subcategories,
    cities,
    coloredTags,
  };
}

export type PortfolioItem = {
  url: string;
  requestId?: string;
  title?: string;
  createdAt?: string;
};

export async function getPortfolio(
  supa: SupabaseClient<any>,
  id: string,
  limit = 18,
): Promise<PortfolioItem[]> {
  const supaClient = supa as any;
  // First, prefer approved public gallery stored in 'professionals-gallery'
  try {
    const prefix = `${id}/`;
    const { data, error } = await supaClient.storage
      .from("professionals-gallery")
      .list(prefix, {
        limit: Math.max(limit, 18),
        sortBy: { column: "updated_at", order: "desc" },
      });
    if (!error && Array.isArray(data) && data.length) {
      const items = await Promise.all(
        data
          .filter((x: any) => x && x.name)
          .slice(0, limit)
          .map(async (obj: any) => {
            const path = `${prefix}${obj.name}`;
            // Try signed URL first (works for private buckets). Fallback to public URL.
            const signed = await supaClient.storage
              .from("professionals-gallery")
              .createSignedUrl(path, 60 * 60, {
                // Serve inline and pre-resized for faster loading
                transform: { width: 800, quality: 80, resize: "contain" },
              }) // 1 hour
              .catch(() => ({ data: null, error: null }));
            let url = (signed?.data?.signedUrl as string | undefined) || "";
            if (!url) {
              const pub = supaClient.storage
                .from("professionals-gallery")
                .getPublicUrl(path, {
                  transform: { width: 800, quality: 80, resize: "contain" },
                });
              url = (pub?.data?.publicUrl as string | undefined) || "";
            }
            return {
              url,
              title: "",
              createdAt: (obj as any)?.updated_at || undefined,
            } as PortfolioItem;
          }),
      );
      const filtered = items.filter((x) => !!x.url);
      if (filtered.length) return filtered;
    }
  } catch {
    /* ignore and fallback to service_photos */
  }
  try {
    // Intento con join directo a requests para traer el título
    // TODO: si service_photos no tiene professional_id, unir vía requests.professional_id
    const res = await supaClient
      .from("service_photos")
      .select(
        "request_id, image_url, url, created_at, uploaded_at, requests!inner(title)",
      )
      .eq("professional_id" as any, id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (res.error) throw res.error;
    const rows = res.data as Array<{
      request_id: string;
      image_url?: string | null;
      url?: string | null;
      created_at?: string | null;
      uploaded_at?: string | null;
      requests?: { title?: string | null } | null;
    }>;
    return (
      (rows ?? []).map((p) => ({
        url: (p.url ?? p.image_url) as string | undefined,
        requestId: p.request_id,
        title: (p.requests?.title as string | null) ?? "",
        createdAt: (p.created_at ?? p.uploaded_at) || undefined,
      })) as PortfolioItem[]
    ).filter((p) => !!p.url);
  } catch {
    // Fallback a consulta doble sin join
    const { data } = await supaClient
      .from("service_photos")
      .select("id, request_id, image_url, uploaded_at")
      .eq("professional_id", id)
      .order("uploaded_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    const photos = (data ?? []) as Array<Record<string, unknown>>;
    const reqIds = Array.from(new Set(photos.map((p) => p.request_id))).filter(
      Boolean,
    ) as string[];
    const titles = new Map<string, string>();
    if (reqIds.length) {
      const rq = await supaClient
        .from("requests")
        .select("id, title")
        .in("id", reqIds);
      const rows = (rq.data ?? []) as Array<Record<string, unknown>>;
      rows.forEach((r) => {
        const key = typeof r.id === "string" ? r.id : String(r.id ?? "");
        if (!key) return;
        const value = typeof r.title === "string" ? r.title : "";
        titles.set(key, value);
      });
    }
    return photos
      .map<PortfolioItem | null>((x) => {
        const directUrl =
          typeof (x as { url?: unknown }).url === "string"
            ? (x as { url: string }).url
            : null;
        const fallbackUrl =
          typeof x.image_url === "string" ? x.image_url : null;
        const reqId =
          typeof x.request_id === "string" ? x.request_id : undefined;
        const titleKey = reqId ?? String(x.request_id ?? "");
        const finalUrl = directUrl || fallbackUrl;
        if (!finalUrl) return null;
        return {
          url: finalUrl,
          requestId: reqId,
          title: titles.get(titleKey) || "",
          createdAt:
            typeof x.uploaded_at === "string" ? x.uploaded_at : undefined,
        };
      })
      .filter((p): p is PortfolioItem => Boolean(p));
  }
}

export type ReviewItemDTO = {
  id: string;
  stars: number;
  comment?: string;
  createdAt: string;
  clientName?: string;
  clientAvatarUrl?: string;
};

export async function getReviews(
  supa: SupabaseClient<any>,
  id: string,
  limit = 10,
  _cursor?: string,
): Promise<{
  items: ReviewItemDTO[];
  nextCursor: string | null;
  count: number;
  average: number | null;
}> {
  const supaClient = supa as any;
  // Robust two-step approach: fetch ratings by to_user_id, then enrich with client profiles
  const rsel = await supaClient
    .from("ratings")
    .select("id, from_user_id, stars, comment, created_at")
    .eq("to_user_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (rsel.data ?? []) as Array<{
    id: string;
    from_user_id: string;
    stars: number | null;
    comment: string | null;
    created_at: string | null;
  }>;
  const authorIds = Array.from(new Set(rows.map((r) => r.from_user_id))).filter(
    Boolean,
  ) as string[];
  const profs = authorIds.length
    ? await supaClient
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", authorIds)
    : {
        data: [] as Array<{
          id: string;
          full_name: string | null;
          avatar_url: string | null;
        }>,
      };
  const map = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();
  (profs.data ?? []).forEach((a) => {
    if (!a || !a.id) return;
    map.set(String(a.id), {
      full_name: a.full_name ?? null,
      avatar_url: a.avatar_url ?? null,
    });
  });
  const items: ReviewItemDTO[] = rows.map((r) => ({
    id: String(r.id),
    stars: Number(r.stars ?? 0),
    comment: (r.comment as string | null) || undefined,
    createdAt: (r.created_at as string | null) || "",
    clientName:
      (map.get(String(r.from_user_id))?.full_name as string | null) ||
      undefined,
    clientAvatarUrl:
      (map.get(String(r.from_user_id))?.avatar_url as string | null) ||
      undefined,
  }));

  const nextCursor = items.length
    ? `${items[items.length - 1].createdAt}|${items[items.length - 1].id}`
    : null;

  const summary = await getProfessionalRatingSummary(supaClient, id);
  return {
    items,
    nextCursor,
    count: summary.count,
    average: summary.average,
  };
}
