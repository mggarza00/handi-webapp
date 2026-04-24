export type PayoutSeriesInterval = "week" | "fortnight" | "month";

export type EarningsSeriesPoint = {
  label: string;
  amount: number;
};

export type PaidPayoutRow = {
  paid_at: string | null;
  amount: number | null;
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function startOfWeek(date: Date): Date {
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = normalized.getUTCDay();
  const diff = (day + 6) % 7;
  normalized.setUTCDate(normalized.getUTCDate() - diff);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function formatLabel(
  date: Date,
  interval: PayoutSeriesInterval,
  _indexInRange: number,
): string {
  const year = date.getUTCFullYear();
  if (interval === "week") {
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const monday = startOfWeek(date);
    const diffDays = Math.floor(
      (monday.getTime() - startOfWeek(jan1).getTime()) / (1000 * 60 * 60 * 24),
    );
    const week = Math.floor(diffDays / 7) + 1;
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  if (interval === "fortnight") {
    const month = date.getUTCMonth() + 1;
    const fortnight = date.getUTCDate() <= 15 ? 1 : 2;
    return `${year}-${String(month).padStart(2, "0")}-Q${fortnight}`;
  }
  const month = date.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getPeriodBoundaries(
  interval: PayoutSeriesInterval,
  periods = 6,
  now = new Date(),
): Array<{ from: Date; to: Date; label: string }> {
  const ranges: Array<{ from: Date; to: Date; label: string }> = [];
  let cursor: Date;
  if (interval === "week") {
    cursor = startOfWeek(now);
  } else if (interval === "fortnight") {
    cursor = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() <= 15 ? 1 : 16,
      ),
    );
    cursor.setUTCHours(0, 0, 0, 0);
  } else {
    cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    cursor.setUTCHours(0, 0, 0, 0);
  }

  for (let index = 0; index < periods; index += 1) {
    const from = new Date(cursor);
    let to = new Date(cursor);
    if (interval === "week") {
      to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
      cursor = new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (interval === "fortnight") {
      if (from.getUTCDate() === 1) {
        to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 16));
        cursor = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 16),
        );
      } else {
        to = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
        );
        cursor = new Date(
          Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
        );
      }
    } else {
      to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
      cursor = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1),
      );
    }

    ranges.unshift({ from, to, label: formatLabel(from, interval, index) });
  }

  return ranges;
}

export function buildPayoutSeries(
  rows: PaidPayoutRow[],
  interval: PayoutSeriesInterval,
  now = new Date(),
  periods = 6,
): EarningsSeriesPoint[] {
  const ranges = getPeriodBoundaries(interval, periods, now);
  const sums = new Map<string, number>(ranges.map((range) => [range.label, 0]));

  for (const row of rows) {
    if (!row.paid_at) continue;
    const amount =
      typeof row.amount === "number" && Number.isFinite(row.amount)
        ? row.amount
        : 0;
    if (amount <= 0) continue;
    const paidAt = new Date(row.paid_at);
    if (Number.isNaN(paidAt.getTime())) continue;

    for (const range of ranges) {
      if (paidAt >= range.from && paidAt < range.to) {
        const current = sums.get(range.label) || 0;
        sums.set(range.label, round2(current + amount));
        break;
      }
    }
  }

  return ranges.map((range) => ({
    label: range.label,
    amount: round2(sums.get(range.label) || 0),
  }));
}
