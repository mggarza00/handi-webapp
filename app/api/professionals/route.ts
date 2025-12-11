import { NextResponse } from "next/server";
import createClient from "@/utils/supabase/server";

// import { z } from "zod";
import { getUserOrThrow } from "@/lib/_supabase-server";
import {
  filterProfessionalsByRequest,
  toNames,
} from "@/lib/professionals/filter";
import {
  clearRequestProAlert,
  queueRequestProAlert,
} from "@/lib/request-pro-alerts";
import { createServerClient as createServiceClient } from "@/lib/supabase";
import { ProfileUpsertSchema } from "@/lib/validators/profiles";
import type { Database } from "@/types/supabase";

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

// GET /api/professionals?city=Monterrey&category=Plomería&page=1
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city")?.trim() || null;
    const category = searchParams.get("category")?.trim() || null;
    const subcategory = searchParams.get("subcategory")?.trim() || null;
    const wantDebug = searchParams.get("debug") === "1";
    const includeIncomplete = searchParams.get("include_incomplete") === "1";
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const requestId = searchParams.get("request_id")?.trim() || null;
    const limit = 60;
    const offset = (page - 1) * limit;

    // Público: no requerir sesión para explorar profesionales
    const supabase = createClient();
    let requestOwnerId: string | null = null;
    let requestMeta: {
      city: string | null;
      category: string | null;
      subcategories: unknown;
      title: string | null;
    } | null = null;
    if (requestId) {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id ?? null;
        if (userId) {
          const { data: req } = await supabase
            .from("requests")
            .select("id, created_by, title, city, category, subcategories")
            .eq("id", requestId)
            .maybeSingle();
          if (
            req &&
            typeof req.created_by === "string" &&
            req.created_by === userId
          ) {
            requestOwnerId = userId;
            requestMeta = {
              city: (req.city as string | null) ?? null,
              category: (req.category as string | null) ?? null,
              subcategories: req.subcategories ?? null,
              title: (req.title as string | null) ?? null,
            };
          }
        }
      } catch {
        /* ignore */
      }
    }
    // Trae profesionales activos con campos necesarios; city se filtra en BD por ciudad exacta
    const query = supabase
      .from("professionals_with_profile")
      .select(
        "id, full_name, avatar_url, headline, bio, rating, years_experience, is_featured, last_active_at, city, cities, categories, subcategories, active, empresa",
      )
      .or("active.is.true,active.is.null")
      .order("is_featured", { ascending: false })
      .order("rating", { ascending: false, nullsFirst: false })
      .order("last_active_at", { ascending: false, nullsFirst: false });

    // Paginación amplia previa a filtros en memoria para no perder candidatos
    const { data, error } = await query.range(0, 199); // hasta 200 candidatos

    // Si RLS bloquea o devuelve 0 (por políticas), intenta con Service Role para datos públicos
    let rows = data as unknown[] | null;
    let source: "public" | "admin" = "public";
    if (error || !rows || rows.length === 0) {
      try {
        const admin = createServiceClient();
        const r = await admin
          .from("professionals_with_profile")
          .select(
            "id, full_name, avatar_url, headline, bio, rating, years_experience, is_featured, last_active_at, city, cities, categories, subcategories, active, empresa",
          )
          .or("active.is.true,active.is.null")
          .order("is_featured", { ascending: false })
          .order("rating", { ascending: false, nullsFirst: false })
          .order("last_active_at", { ascending: false, nullsFirst: false })
          .range(0, 499);
        if (r.error) {
          return NextResponse.json(
            { ok: false, error: "LIST_FAILED", detail: r.error.message },
            { status: 400, headers: JSONH },
          );
        }
        rows = r.data as unknown[];
        source = "admin";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
        // Si falla el fallback admin (p. ej. falta SERVICE_ROLE), no interrumpir: responde vacío.
        const payload = {
          ok: true,
          data: [] as unknown[],
          meta: wantDebug ? { source: "admin_error", error: msg } : undefined,
        };
        return NextResponse.json(payload, { status: 200, headers: JSONH });
      }
    }

    const list = Array.isArray(rows) ? rows : [];
    // Utilidades para normalizar arrays JSON que pueden venir como:
    // - Array de strings u objetos { name }
    // - Cadena JSON serializada de lo anterior
    // - Cadena separada por comas
    const filtered = filterProfessionalsByRequest(list, {
      city,
      category,
      subcategory,
      includeIncomplete,
    });

    if (requestId && requestOwnerId) {
      try {
        if (filtered.length === 0) {
          await queueRequestProAlert({
            requestId,
            userId: requestOwnerId,
            requestTitle: requestMeta?.title ?? null,
            city: requestMeta?.city ?? city,
            category: requestMeta?.category ?? category,
            subcategory,
            subcategories: requestMeta?.subcategories,
          });
        } else {
          await clearRequestProAlert(requestId);
        }
      } catch {
        /* ignore queue errors */
      }
    }

    const totalCount = filtered.length;
    const pageItems = filtered.slice(offset, offset + limit);
    // Mapea solo campos necesarios al cliente
    let mapped = pageItems.map((r) => {
      const x = r as Record<string, unknown>;
      const rawRating =
        (x.rating as unknown) ??
        (x as any)?.profiles?.rating ??
        (x as any)?.profile?.rating;
      let rating: number | null = null;
      if (typeof rawRating === "number") {
        rating = rawRating;
      } else if (typeof rawRating === "string") {
        const n = Number(rawRating);
        rating = Number.isFinite(n) ? n : null;
      }
      return {
        id: String(x.id ?? ""),
        full_name: (x.full_name as string | null) ?? null,
        avatar_url: (x.avatar_url as string | null) ?? null,
        headline: (x.headline as string | null) ?? null,
        bio: (x.bio as string | null) ?? null,
        rating,
        // Extra fields useful for client cards
        years_experience:
          typeof x.years_experience === "number" &&
          Number.isFinite(x.years_experience)
            ? (x.years_experience as number)
            : null,
        categories: toNames(x.categories),
        subcategories: toNames(x.subcategories),
        city: (x.city as string | null) ?? null,
        jobsDone: null as number | null,
      } as const;
    });

    // Prefer rating de profiles.rating cuando falte
    try {
      const missingIds = mapped
        .filter((m) => m.rating === null)
        .map((m) => m.id);
      if (missingIds.length) {
        const profileRatings = new Map<string, number>();
        try {
          const admin = createServiceClient();
          const pr = await admin
            .from("profiles")
            .select("id, rating")
            .in("id", missingIds);
          if (!pr.error && Array.isArray(pr.data)) {
            for (const row of pr.data as any[]) {
              const id = String((row as any).id ?? "");
              const rt = Number((row as any).rating);
              if (id && Number.isFinite(rt)) profileRatings.set(id, rt);
            }
          }
        } catch {
          /* ignore */
        }
        if (profileRatings.size) {
          mapped = mapped.map((m) =>
            m.rating === null && profileRatings.has(m.id)
              ? { ...m, rating: profileRatings.get(m.id) ?? null }
              : m,
          );
        }
      }
    } catch {
      /* ignore profile rating errors */
    }

    // Fallback: if rating is null, compute average from public.ratings
    try {
      const missingIds = mapped
        .filter((m) => m.rating === null)
        .map((m) => m.id);
      if (missingIds.length) {
        // Prefer public client (RLS allows select) to avoid depending on SERVICE_ROLE
        let agg: Array<{ to_user_id: string; avg: unknown }> | null = null;
        try {
          const pub = createClient() as any;
          const r = await pub
            .from("ratings")
            .select("to_user_id, avg:avg(stars)")
            .in("to_user_id", missingIds)
            .group("to_user_id");
          if (!r.error && Array.isArray(r.data)) agg = r.data as any[];
        } catch {
          // fall back to service role below
        }
        if (!agg) {
          try {
            const admin = createServiceClient() as any;
            const r = await admin
              .from("ratings")
              .select("to_user_id, avg:avg(stars)")
              .in("to_user_id", missingIds)
              .group("to_user_id");
            if (!r.error && Array.isArray(r.data)) agg = r.data as any[];
          } catch {
            // ignore
          }
        }
        if (agg && agg.length) {
          const map = new Map<string, number>();
          for (const row of agg) {
            const n = Number((row as any).avg);
            if (Number.isFinite(n)) map.set(String((row as any).to_user_id), n);
          }
          mapped = mapped.map((m) =>
            m.rating === null && map.has(m.id)
              ? { ...m, rating: map.get(m.id)! }
              : m,
          );
        }
      }
    } catch {
      // ignore fallback errors; keep mapped as-is
    }

    // Servicios completados (agreements pagados o completados; fallback ratings count)
    const fetchJobsDone = async (ids: string[]) => {
      const map = new Map<string, number>();
      if (!ids.length) return map;
      try {
        const admin = createServiceClient();
        const a = await admin
          .from("agreements")
          .select("professional_id, count:count(*)")
          .in("professional_id", ids)
          .in("status", ["completed", "paid"])
          .group("professional_id");
        if (!a.error && Array.isArray(a.data)) {
          for (const row of a.data as any[]) {
            const id = String((row as any).professional_id ?? "");
            const c = Number((row as any).count ?? 0);
            if (id) map.set(id, c);
          }
        }
        if (map.size === 0) {
          const r = await admin
            .from("ratings")
            .select("to_user_id, count:count(*)")
            .in("to_user_id", ids)
            .group("to_user_id");
          if (!r.error && Array.isArray(r.data)) {
            for (const row of r.data as any[]) {
              const id = String((row as any).to_user_id ?? "");
              const c = Number((row as any).count ?? 0);
              if (id) map.set(id, c);
            }
          }
        }
      } catch {
        /* ignore */
      }
      return map;
    };

    try {
      const ids = mapped.map((m) => m.id).filter(Boolean);
      const jobsMap = await fetchJobsDone(ids);
      if (jobsMap.size) {
        mapped = mapped.map((m) =>
          jobsMap.has(m.id) ? { ...m, jobsDone: jobsMap.get(m.id) ?? null } : m,
        );
      }
    } catch {
      // ignore job count errors
    }

    const metaCommon = {
      total: totalCount,
      page,
      limit,
    } as const;

    const payload = wantDebug
      ? {
          ok: true,
          data: mapped,
          meta: {
            ...metaCommon,
            source,
            totalAll: list.length,
            strict: filtered.length,
            returned: pageItems.length,
            city,
            category,
            subcategory,
          },
        }
      : { ok: true, data: mapped, meta: metaCommon };
    return NextResponse.json(payload, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "INTERNAL_ERROR";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: JSONH },
    );
  }
}

// POST /api/professionals → upsert perfil propio
export async function POST(req: Request) {
  try {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "UNSUPPORTED_MEDIA_TYPE" },
        { status: 415, headers: JSONH },
      );
    }

    const supabase = createClient();
    const { user } = await getUserOrThrow(supabase);
    const parsed = ProfileUpsertSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          detail: parsed.error.flatten(),
        },
        { status: 422, headers: JSONH },
      );
    }

    const input = parsed.data;
    const update: Database["public"]["Tables"]["professionals"]["Update"] = {
      full_name: input.full_name ?? undefined,
      avatar_url: input.avatar_url ?? undefined,
      headline: input.headline ?? undefined,
      bio: input.bio ?? undefined,
      years_experience: input.years_experience ?? undefined,
      empresa: input.empresa ?? undefined,
      city: input.city ?? undefined,
      cities: input.cities ?? undefined,
      categories: input.categories ?? undefined,
      subcategories: input.subcategories ?? undefined,
      active: true,
      last_active_at: new Date().toISOString(),
    };

    // Intento de update primero
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: upd, error: updErr } = await (supabase as any)
      .from("professionals")
      .update(update)
      .eq("id", user.id)
      .select("id")
      .single();

    if (!upd && updErr) {
      // Intentar insert si no existe
      // Relax typing for insert to avoid friction with generated types
      const insert = {
        id: user.id,
        full_name: input.full_name ?? null,
        avatar_url: input.avatar_url ?? null,
        headline: input.headline ?? null,
        bio: input.bio ?? null,
        years_experience: input.years_experience ?? null,
        empresa: input.empresa ?? null,
        city: input.city ?? null,
        cities: input.cities ?? null,
        categories: input.categories ?? null,
        subcategories: input.subcategories ?? null,
        active: true,
        last_active_at: new Date().toISOString(),
      } as unknown as Record<string, unknown>;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ins, error: insErr } = await (supabase as any)
        .from("professionals")
        .insert(insert)
        .select("id")
        .single();

      if (insErr) {
        return NextResponse.json(
          { ok: false, error: "UPSERT_FAILED", detail: insErr.message },
          { status: 400, headers: JSONH },
        );
      }
      // Best-effort: sync profiles.full_name when provided
      try {
        if (
          typeof input.full_name === "string" &&
          input.full_name.trim().length >= 2
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("profiles")
            .update({ full_name: input.full_name.trim() })
            .eq("id", user.id);
        }
      } catch {
        // ignore
      }
      return NextResponse.json(
        { ok: true, id: ins.id },
        { status: 201, headers: JSONH },
      );
    }

    // Best-effort: sync profiles.full_name when provided
    try {
      if (
        typeof input.full_name === "string" &&
        input.full_name.trim().length >= 2
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("profiles")
          .update({ full_name: input.full_name.trim() })
          .eq("id", user.id);
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      { ok: true, id: upd?.id },
      { status: 200, headers: JSONH },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 401, headers: JSONH },
    );
  }
}
