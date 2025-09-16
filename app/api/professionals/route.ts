import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// import { z } from "zod";
import { getUserOrThrow } from "@/lib/_supabase-server";
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
    const limit = 20;
    const offset = (page - 1) * limit;

    // Público: no requerir sesión para explorar profesionales
    const supabase = createRouteHandlerClient<Database>({ cookies });
    // Trae profesionales activos con campos necesarios; city se filtra en BD por ciudad exacta
    const query = supabase
      .from("professionals")
      .select(
        "id, full_name, avatar_url, headline, bio, rating, is_featured, last_active_at, city, cities, categories, subcategories, active, empresa",
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
          .from("professionals")
          .select(
            "id, full_name, avatar_url, headline, bio, rating, is_featured, last_active_at, city, cities, categories, subcategories, active, empresa",
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
        const payload = { ok: true, data: [] as unknown[], meta: wantDebug ? { source: "admin_error", error: msg } : undefined };
        return NextResponse.json(payload, { headers: JSONH });
      }
    }

    const list = Array.isArray(rows) ? rows : [];
    // Utilidades para normalizar arrays JSON que pueden venir como:
    // - Array de strings u objetos { name }
    // - Cadena JSON serializada de lo anterior
    // - Cadena separada por comas
    const toArray = (v: unknown): unknown[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") {
        const s = v.trim();
        // Intentar parse JSON si parece JSON
        if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return parsed as unknown[];
          } catch {
            /* fall through */
          }
        }
        // Fallback: separar por comas
        if (s.includes(",")) {
          return s
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x.length > 0);
        }
        // Último recurso: cadena única como elemento
        return s ? [s] : [];
      }
      return [];
    };

    const toNames = (v: unknown): string[] => {
      const arr = toArray(v);
      return arr
        .map((x) =>
          typeof x === "string"
            ? x
            : x && typeof x === "object"
              ? (x as Record<string, unknown>).name
              : null,
        )
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .map((s) => s.trim());
    };

    const toNorm = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .normalize("NFD")
        // remove accents
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const normCity = city ? toNorm(city) : null;
    const normCategory = category ? toNorm(category) : null;
    const normSub = subcategory ? toNorm(subcategory) : null;

    const filtered = list
      .filter((row) => {
        const r = row as Record<string, unknown>;
        if (r.active === false) return false;

        // Ocultar perfiles incompletos (sin nombre) salvo que se pida explícitamente
        if (!includeIncomplete) {
          const name = typeof r.full_name === "string" ? r.full_name.trim() : "";
          if (!name) return false;
        }

        // City match: exact city OR cities array contains
        if (normCity) {
          const cNorm = toNorm(r.city);
          const citiesArrNorm = toNames(r.cities).map(toNorm);
          const cityOk =
            cNorm === normCity ||
            citiesArrNorm.includes(normCity) ||
            // relaxed contains for cases like "monterrey, nl"
            (cNorm && cNorm.includes(normCity));
          if (!cityOk) return false;
        }

        // Category match (if provided)
        if (normCategory) {
          const catsNorm = toNames(r.categories).map(toNorm);
          const catOk = catsNorm.includes(normCategory);
          if (!catOk) return false;
        }

        // Subcategory match (if provided)
        if (normSub) {
          const subsNorm = toNames(r.subcategories).map(toNorm);
          const subOk = subsNorm.includes(normSub);
          if (!subOk) return false;
        }

        return true;
      })
      // Reordenar similar al RPC
      .sort((a, b) => {
        const aa = a as Record<string, unknown>;
        const bb = b as Record<string, unknown>;
        // is_featured desc
  const f1 = aa.is_featured ? 1 : 0;
  const f2 = bb.is_featured ? 1 : 0;
        if (f1 !== f2) return f2 - f1;
        // rating desc (nulls last)
        const r1 = typeof aa.rating === "number" ? (aa.rating as number) : -1;
        const r2 = typeof bb.rating === "number" ? (bb.rating as number) : -1;
        if (r1 !== r2) return r2 - r1;
        // last_active_at desc (nulls last)
        const d1 = aa.last_active_at ? Date.parse(String(aa.last_active_at)) : 0;
        const d2 = bb.last_active_at ? Date.parse(String(bb.last_active_at)) : 0;
        return d2 - d1;
      });

    // Pagina el resultado final
    // Si no hubo resultados estrictos, intenta sugerencias relajadas (misma ciudad OR categoría OR subcategoría)
    const relaxed = (() => {
      if (filtered.length > 0) return filtered;
      if (!normCity && !normCategory && !normSub) return filtered;
      const pass = list.filter((row) => {
        const r = row as Record<string, unknown>;
        if (r.active === false) return false;
        if (!includeIncomplete) {
          const name = typeof r.full_name === "string" ? r.full_name.trim() : "";
          if (!name) return false;
        }
        const cNorm = toNorm(r.city);
        const citiesArrNorm = toNames(r.cities).map(toNorm);
        const catsNorm = toNames(r.categories).map(toNorm);
        const subsNorm = toNames(r.subcategories).map(toNorm);
        const cityOk = normCity
          ? cNorm === normCity || citiesArrNorm.includes(normCity) || (cNorm && cNorm.includes(normCity))
          : false;
        const catOk = normCategory ? catsNorm.includes(normCategory) : false;
        const subOk = normSub ? subsNorm.includes(normSub) : false;
        return cityOk || catOk || subOk;
      });
      return pass;
    })();

    const pageItems = relaxed.slice(offset, offset + limit);
    // Mapea solo campos necesarios al cliente
    const mapped = pageItems.map((r) => {
      const x = r as Record<string, unknown>;
      return {
        id: String(x.id ?? ""),
        full_name: (x.full_name as string | null) ?? null,
        avatar_url: (x.avatar_url as string | null) ?? null,
        headline: (x.headline as string | null) ?? null,
        bio: (x.bio as string | null) ?? null,
        rating:
          typeof x.rating === "number" ? (x.rating as number) : null,
        // Extra fields useful for client cards
        categories: toNames(x.categories),
        subcategories: toNames(x.subcategories),
        city: (x.city as string | null) ?? null,
      } as const;
    });

    const payload = wantDebug
      ? {
          ok: true,
          data: mapped,
          meta: {
            source,
            total: list.length,
            strict: filtered.length,
            returned: pageItems.length,
            city,
            category,
            subcategory,
          },
        }
      : { ok: true, data: mapped };
    return NextResponse.json(payload, { headers: JSONH });
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

    const supabase = createRouteHandlerClient<Database>({ cookies });
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
        if (typeof input.full_name === "string" && input.full_name.trim().length >= 2) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("profiles").update({ full_name: input.full_name.trim() }).eq("id", user.id);
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
      if (typeof input.full_name === "string" && input.full_name.trim().length >= 2) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("profiles").update({ full_name: input.full_name.trim() }).eq("id", user.id);
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, id: upd?.id }, { status: 200, headers: JSONH });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 401, headers: JSONH },
    );
  }
}
