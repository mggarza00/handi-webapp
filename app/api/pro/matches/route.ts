import { NextResponse } from "next/server";
import getRouteClient from "@/lib/supabase/route-client";

import { getUserOrThrow } from "@/lib/_supabase-server";
import type { Database } from "@/types/supabase";

type UUID = string;

type MatchItem = {
  request_id: UUID;
  title: string | null;
  city: string | null;
  category: string | null;
  subcategories: string[];
  created_at: string;
  score: number;
  reasons: string[];
  source: "profile_match" | "application" | "agreement";
};

type MatchesPayload = {
  matches: MatchItem[];
  profile: {
    id: string;
    full_name: string | null;
    headline: string | null;
    active: boolean | null;
    city: string | null;
    last_active_at: string | null;
    filters: {
      cities: number;
      categories: number;
      subcategories: number;
    };
  } | null;
};

const JSONH = { "Content-Type": "application/json; charset=utf-8" } as const;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function parseNameList(input: unknown): string[] {
  if (!input) return [];
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const entry of input) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) out.push(trimmed);
      continue;
    }
    if (entry && typeof entry === "object" && "name" in entry) {
      const name = (entry as { name?: unknown }).name;
      if (typeof name === "string" && name.trim().length) out.push(name.trim());
    }
  }
  return uniq(out);
}

function parseStringList(input: unknown): string[] {
  if (!input) return [];
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const entry of input) {
    if (typeof entry === "string" && entry.trim().length) out.push(entry.trim());
  }
  return uniq(out);
}

export async function GET() {
  try {
    const supabase = getRouteClient();
    const { user: authUser } = await getUserOrThrow(supabase);

    const { data: profile, error: profileError } = await supabase
      .from("professionals")
      .select(
        "id, full_name, headline, active, city, cities, categories, subcategories, last_active_at",
      )
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile || profile.active === false) {
      const payload: MatchesPayload = {
        matches: [],
        profile: profile
          ? {
              id: profile.id,
              full_name: profile.full_name ?? null,
              headline: profile.headline ?? null,
              active: profile.active ?? null,
              city: profile.city ?? null,
              last_active_at: profile.last_active_at ?? null,
              filters: { cities: 0, categories: 0, subcategories: 0 },
            }
          : null,
      };
      return NextResponse.json({ ok: true, data: payload }, { status: 200, headers: JSONH });
    }

    const proCities = uniq([
      ...(parseStringList(profile.cities as unknown)),
      ...(profile.city ? [profile.city] : []),
    ]);
    const proCategories = parseNameList(profile.categories as unknown);
    const proSubcategories = parseNameList(profile.subcategories as unknown);

    const citySet = new Set(proCities.map(normalize));
    const categorySet = new Set(proCategories.map(normalize));
    const subcategorySet = new Set(proSubcategories.map(normalize));

    const hasCityFilter = citySet.size > 0;
    const hasCategoryFilter = categorySet.size > 0;
    const hasSubcategoryFilter = subcategorySet.size > 0;

    const { data: requests, error: requestsError } = await supabase
      .from("requests")
      .select("id, title, city, category, subcategories, created_at, status, created_by")
      .eq("status", "active")
      .not("created_by", "eq", authUser.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (requestsError) throw requestsError;

    const now = Date.now();
    const matches: MatchItem[] = [];

    for (const request of requests ?? []) {
      if (!request) continue;
      let keep = true;
      const reasons: string[] = [];

      const requestCityNormalized = normalize(request.city);
      if (hasCityFilter) {
        if (requestCityNormalized && citySet.has(requestCityNormalized)) {
          if (request.city) reasons.push(`Ciudad: ${request.city}`);
        } else {
          keep = false;
        }
      }

      const categoryNormalized = normalize(request.category ?? null);
      let categoryMatched = false;
      if (keep && hasCategoryFilter) {
        if (categoryNormalized && categorySet.has(categoryNormalized)) {
          categoryMatched = true;
          if (request.category) reasons.push(`Categoria: ${request.category}`);
        } else {
          keep = false;
        }
      }

      const requestSubcategories = parseNameList(request.subcategories as unknown);
      const matchedSubcategories = keep && hasSubcategoryFilter
        ? requestSubcategories.filter((name) => subcategorySet.has(normalize(name)))
        : [];
      if (keep && hasSubcategoryFilter) {
        if (matchedSubcategories.length > 0) {
          reasons.push(`Coincidencias en subcategorias: ${matchedSubcategories.length}`);
        } else {
          keep = false;
        }
      }

      if (!keep) continue;

      const createdAtIso = request.created_at ?? new Date().toISOString();
      const ageHours = Math.max(0, (now - new Date(createdAtIso).getTime()) / 36e5);
      const recencyScore = Math.max(0, 50 - ageHours);
      const baseScore =
        (hasCityFilter ? 20 : 0) +
        (categoryMatched ? 25 : hasCategoryFilter ? 0 : 10) +
        (matchedSubcategories.length > 0
          ? Math.min(30, matchedSubcategories.length * 10)
          : hasSubcategoryFilter
            ? 0
            : 10);

      matches.push({
        request_id: request.id,
        title: request.title ?? null,
        city: request.city ?? null,
        category: request.category ?? null,
        subcategories: requestSubcategories,
        created_at: createdAtIso,
        score: Math.round(baseScore + recencyScore),
        reasons,
        source: "profile_match",
      });
    }

    matches.sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
    const limited = matches.slice(0, 20);

    const payload: MatchesPayload = {
      matches: limited,
      profile: {
        id: profile.id,
        full_name: profile.full_name ?? null,
        headline: profile.headline ?? null,
        active: profile.active ?? null,
        city: profile.city ?? null,
        last_active_at: profile.last_active_at ?? null,
        filters: {
          cities: citySet.size,
          categories: categorySet.size,
          subcategories: subcategorySet.size,
        },
      },
    };

    return NextResponse.json({ ok: true, data: payload }, { status: 200, headers: JSONH });
  } catch (e: unknown) {
    const msg = errorMessage(e);
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: msg },
      {
        status,
        headers: JSONH,
      },
    );
  }
}
