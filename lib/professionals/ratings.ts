export type RatingsAggregate = {
  ratingAvg: number;
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

export function resolveProfessionalRating(args: {
  aggregate: RatingsAggregate | null;
  legacyRating: number | null;
}): number | null {
  const { aggregate, legacyRating } = args;
  if (aggregate && aggregate.reviewsCount > 0) return aggregate.ratingAvg;
  return legacyRating;
}
