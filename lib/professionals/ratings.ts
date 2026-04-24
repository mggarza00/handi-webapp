import type { SupabaseClient } from "@supabase/supabase-js";

export type RatingsAggregate = {
  ratingAvg: number;
  reviewsCount: number;
};

export type RatingStarsRow = {
  stars?: unknown;
};

export type ProfessionalRatingSummary = {
  average: number | null;
  count: number;
};

type RatingsSelectResponse = Promise<{
  data?: Array<{ stars?: unknown }> | null;
  count?: number | null;
  error?: { message?: string } | null;
}>;

type RatingsSelectBuilder = {
  eq: (column: string, value: string) => RatingsSelectResponse;
};

type RatingsSource = {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { head?: boolean; count?: "exact" },
    ) => RatingsSelectBuilder;
  };
};

export type ResolvedRating = {
  rating: number | null;
  reviewsCount: number;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const toNonNegativeInt = (value: unknown): number | null => {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  return n >= 0 ? Math.trunc(n) : null;
};

const normalizeProfessionalIds = (ids: string[]): string[] =>
  Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));

export function normalizeProfessionalRating(value: unknown): number | null {
  return toFiniteNumber(value);
}

export function buildRatingsAggregateMap(
  rows: Array<Record<string, unknown>> | null | undefined,
): Map<string, RatingsAggregate> {
  const map = new Map<string, RatingsAggregate>();
  const sums = new Map<string, { sum: number; count: number }>();
  for (const row of rows ?? []) {
    const idRaw = row.to_user_id;
    const id = typeof idRaw === "string" ? idRaw : String(idRaw ?? "").trim();
    if (!id) continue;
    const stars = toFiniteNumber(row.stars);
    if (stars !== null) {
      const current = sums.get(id) ?? { sum: 0, count: 0 };
      current.sum += stars;
      current.count += 1;
      sums.set(id, current);
      continue;
    }
    const ratingAvg = toFiniteNumber(row.avg);
    const reviewsCount = toNonNegativeInt(row.count);
    if (ratingAvg === null || reviewsCount === null || reviewsCount <= 0) {
      continue;
    }
    map.set(id, { ratingAvg, reviewsCount });
  }
  for (const [id, aggregate] of sums) {
    if (aggregate.count <= 0) continue;
    map.set(id, {
      ratingAvg: Math.round((aggregate.sum / aggregate.count) * 10) / 10,
      reviewsCount: aggregate.count,
    });
  }
  return map;
}

export async function fetchRatingsAggregateMap(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, RatingsAggregate>> {
  const normalizedIds = normalizeProfessionalIds(ids);
  if (!normalizedIds.length) return new Map<string, RatingsAggregate>();

  const { data, error } = await supabase
    .from("ratings")
    .select("to_user_id, stars")
    .in("to_user_id", normalizedIds);
  if (error || !Array.isArray(data)) {
    return new Map<string, RatingsAggregate>();
  }
  return buildRatingsAggregateMap(data as Array<Record<string, unknown>>);
}

export async function fetchProfessionalRatingTargetMap(
  supabase: SupabaseClient,
  professionalIds: string[],
): Promise<Map<string, string>> {
  const normalizedIds = normalizeProfessionalIds(professionalIds);
  const map = new Map<string, string>(
    normalizedIds.map((id) => [id, id] as const),
  );
  if (!normalizedIds.length) return map;

  const { data, error } = await supabase
    .from("professionals")
    .select("id, user_id")
    .in("id", normalizedIds);
  if (error || !Array.isArray(data)) {
    return map;
  }

  for (const row of data as Array<Record<string, unknown>>) {
    const professionalId =
      typeof row.id === "string" ? row.id.trim() : String(row.id ?? "").trim();
    if (!professionalId) continue;
    const ratingTargetId =
      typeof row.user_id === "string"
        ? row.user_id.trim()
        : String(row.user_id ?? "").trim();
    if (ratingTargetId) {
      map.set(professionalId, ratingTargetId);
    }
  }

  return map;
}

export function buildRatingsAggregateFromStars(
  rows: RatingStarsRow[] | null | undefined,
): RatingsAggregate | null {
  let reviewsCount = 0;
  let ratingSum = 0;

  for (const row of rows ?? []) {
    const stars = toFiniteNumber(row?.stars);
    if (stars === null) continue;
    reviewsCount += 1;
    ratingSum += stars;
  }

  if (reviewsCount <= 0) return null;

  return {
    ratingAvg: Math.round((ratingSum / reviewsCount) * 10) / 10,
    reviewsCount,
  };
}

export async function getProfessionalRatingSummary(
  supabase: RatingsSource,
  professionalId: string,
): Promise<ProfessionalRatingSummary> {
  const readRows = async (column: string) => {
    const response = await supabase
      .from("ratings")
      .select("stars", { head: false, count: "exact" })
      .eq(column, professionalId);

    if (response?.error) return null;

    const rows = Array.isArray(response?.data) ? response.data : [];
    return {
      rows,
      count: typeof response?.count === "number" ? response.count : rows.length,
    };
  };

  const primary = await readRows("to_user_id");
  const fallback = primary || (await readRows("professional_id"));

  if (!fallback) return { average: null, count: 0 };

  const aggregate = buildRatingsAggregateFromStars(fallback.rows);
  return {
    average: aggregate?.ratingAvg ?? null,
    count: fallback.count,
  };
}

export function resolveProfessionalRating(args: {
  aggregate: RatingsAggregate | null;
  legacyRating: number | null;
}): number | null {
  const { aggregate, legacyRating } = args;
  if (aggregate && aggregate.reviewsCount > 0) return aggregate.ratingAvg;
  return legacyRating;
}

export function resolveProfessionalRatingData(args: {
  aggregateMap: Map<string, RatingsAggregate>;
  entityId: string;
  ratingTargetId?: string | null;
  legacyRating: number | null;
}): ResolvedRating {
  const ratingTargetId =
    typeof args.ratingTargetId === "string" && args.ratingTargetId.trim()
      ? args.ratingTargetId.trim()
      : args.entityId;
  const aggregate = args.aggregateMap.get(ratingTargetId) ?? null;
  return {
    rating: resolveProfessionalRating({
      aggregate,
      legacyRating: args.legacyRating,
    }),
    reviewsCount: aggregate?.reviewsCount ?? 0,
  };
}
