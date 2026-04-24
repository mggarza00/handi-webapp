const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export function normalizeProfessionalRating(value: unknown): number | null {
  const rating = toFiniteNumber(value);
  if (rating === null) return null;
  if (rating < 0 || rating > 5) return null;
  return Math.round(rating * 10) / 10;
}

export function formatProfessionalRatingWithStar(
  value: unknown,
): string | null {
  const rating = normalizeProfessionalRating(value);
  if (rating === null) return null;
  const formatted = Number.isInteger(rating)
    ? rating.toString()
    : rating.toFixed(1);
  return `${formatted} ★`;
}

export function normalizeCompletedJobsDone(value: unknown): number {
  const count = toFiniteNumber(value);
  if (count === null || count < 0) return 0;
  return Math.trunc(count);
}

export function formatCompletedServicesLabel(value: unknown): string {
  const count = normalizeCompletedJobsDone(value);
  const serviceLabel = count === 1 ? "servicio" : "servicios";
  const doneLabel = count === 1 ? "realizado" : "realizados";
  return `${count} ${serviceLabel} ${doneLabel}`;
}
