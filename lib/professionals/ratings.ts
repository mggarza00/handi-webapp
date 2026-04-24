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

export function buildRatingsAggregateMap(
  rows: Array<Record<string, unknown>> | null | undefined,
): Map<string, RatingsAggregate> {
  const map = new Map<string, RatingsAggregate>();
  for (const row of rows ?? []) {
    const idRaw = row.to_user_id;
    const id = typeof idRaw === "string" ? idRaw : String(idRaw ?? "").trim();
    if (!id) continue;
    const ratingAvg = toFiniteNumber(row.avg);
    const reviewsCount = toNonNegativeInt(row.count);
    if (ratingAvg === null || reviewsCount === null || reviewsCount <= 0) {
      continue;
    }
    map.set(id, { ratingAvg, reviewsCount });
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
