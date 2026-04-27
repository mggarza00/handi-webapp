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

export type ResolvedRating = {
  rating: number | null;
  reviewsCount: number;
};

type RatingAggregateRow = {
  to_user_id?: unknown;
  stars?: unknown;
  avg?: unknown;
  count?: unknown;
};

type RatingsAggregateQueryClient = {
  from: (table: string) => {
    select: (query: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{
        data: Array<Record<string, unknown>> | null;
        error: unknown;
      }>;
    };
  };
};

type ProfessionalTargetQueryClient = {
  from: (table: string) => {
    select: (query: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{
        data: Array<Record<string, unknown>> | null;
        error: unknown;
      }>;
    };
  };
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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNormalizedId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const toNonNegativeInt = (value: unknown): number | null => {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) return null;
  return Math.trunc(numeric);
};

export function normalizeProfessionalRating(value: unknown): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric === null || numeric < 0) return null;
  return Math.round(numeric * 10) / 10;
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
    ratingAvg: normalizeProfessionalRating(ratingSum / reviewsCount) ?? 0,
    reviewsCount,
  };
}

export function buildRatingsAggregateMap(
  rows: Array<Record<string, unknown>> | null | undefined,
): Map<string, RatingsAggregate> {
  const totals = new Map<string, { sum: number; count: number }>();
  const normalizedRows = (rows ?? []) as RatingAggregateRow[];

  for (const row of normalizedRows) {
    const targetId = toNormalizedId(row.to_user_id);
    if (!targetId) continue;

    const rawStars = toFiniteNumber(row.stars);
    if (rawStars !== null) {
      const current = totals.get(targetId) ?? { sum: 0, count: 0 };
      current.sum += rawStars;
      current.count += 1;
      totals.set(targetId, current);
      continue;
    }

    const ratingAvg = toFiniteNumber(row.avg);
    const reviewsCount = toNonNegativeInt(row.count);
    if (ratingAvg === null || reviewsCount === null || reviewsCount <= 0) {
      continue;
    }

    const current = totals.get(targetId) ?? { sum: 0, count: 0 };
    current.sum += ratingAvg * reviewsCount;
    current.count += reviewsCount;
    totals.set(targetId, current);
  }

  const aggregateMap = new Map<string, RatingsAggregate>();
  for (const [targetId, entry] of totals.entries()) {
    if (entry.count <= 0) continue;
    aggregateMap.set(targetId, {
      ratingAvg: normalizeProfessionalRating(entry.sum / entry.count) ?? 0,
      reviewsCount: entry.count,
    });
  }

  return aggregateMap;
}

export async function fetchRatingsAggregateMap(
  supabase: RatingsAggregateQueryClient,
  ids: string[],
): Promise<Map<string, RatingsAggregate>> {
  const normalizedIds = Array.from(
    new Set(ids.map((id) => toNormalizedId(id)).filter(Boolean)),
  ) as string[];

  if (normalizedIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("ratings")
    .select("to_user_id, stars")
    .in("to_user_id", normalizedIds);

  if (error) return new Map();
  return buildRatingsAggregateMap(
    (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>,
  );
}

export async function fetchProfessionalRatingTargetMap(
  supabase: ProfessionalTargetQueryClient,
  professionalIds: string[],
): Promise<Map<string, string>> {
  const normalizedIds = Array.from(
    new Set(professionalIds.map((id) => toNormalizedId(id)).filter(Boolean)),
  ) as string[];

  const fallbackMap = new Map<string, string>(
    normalizedIds.map((professionalId) => [professionalId, professionalId]),
  );

  if (normalizedIds.length === 0) return fallbackMap;

  const { data, error } = await supabase
    .from("professionals")
    .select("id, user_id")
    .in("id", normalizedIds);

  if (error || !Array.isArray(data)) return fallbackMap;

  for (const row of data as Array<Record<string, unknown>>) {
    const professionalId = toNormalizedId(row.id);
    if (!professionalId) continue;
    fallbackMap.set(
      professionalId,
      toNormalizedId(row.user_id) ?? professionalId,
    );
  }

  return fallbackMap;
}

export async function getUserRatingSummary(
  supabase: RatingsSource,
  userId: string,
): Promise<ProfessionalRatingSummary> {
  const readRows = async (column: string) => {
    const response = await supabase
      .from("ratings")
      .select("stars", { head: false, count: "exact" })
      .eq(column, userId);

    if (response?.error) return null;

    const rows = Array.isArray(response?.data) ? response.data : [];
    return {
      rows,
      count: typeof response?.count === "number" ? response.count : rows.length,
    };
  };

  const primary = await readRows("to_user_id");
  const hasCanonicalRows =
    primary !== null && (primary.count > 0 || primary.rows.length > 0);
  const fallback = hasCanonicalRows
    ? primary
    : ((await readRows("professional_id")) ?? primary);

  if (!fallback) return { average: null, count: 0 };

  const aggregate = buildRatingsAggregateFromStars(fallback.rows);
  return {
    average: aggregate?.ratingAvg ?? null,
    count: fallback.count,
  };
}

export async function getProfessionalRatingSummary(
  supabase: RatingsSource,
  professionalId: string,
): Promise<ProfessionalRatingSummary> {
  return getUserRatingSummary(supabase, professionalId);
}

export function resolveProfessionalRating(args: {
  aggregate: RatingsAggregate | null;
  legacyRating: number | null;
}): number | null {
  const { aggregate, legacyRating } = args;
  if (aggregate && aggregate.reviewsCount > 0) return aggregate.ratingAvg;
  return normalizeProfessionalRating(legacyRating);
}

export function resolveProfessionalRatingData(args: {
  aggregateMap?: Map<string, RatingsAggregate> | null;
  legacyRating?: number | null;
  professionalId?: string | null;
  entityId?: string | null;
  ratingTargetId?: string | null;
  ratingTargetMap?: Map<string, string> | null;
}): ResolvedRating {
  const professionalId = toNormalizedId(args.professionalId ?? args.entityId);
  const explicitTargetId = toNormalizedId(args.ratingTargetId);
  const mappedTargetId =
    professionalId && args.ratingTargetMap
      ? toNormalizedId(args.ratingTargetMap.get(professionalId))
      : null;
  const targetId = explicitTargetId ?? mappedTargetId ?? professionalId;
  const aggregate =
    targetId && args.aggregateMap
      ? (args.aggregateMap.get(targetId) ?? null)
      : null;

  return {
    rating: resolveProfessionalRating({
      aggregate,
      legacyRating: args.legacyRating ?? null,
    }),
    reviewsCount: aggregate?.reviewsCount ?? 0,
  };
}
