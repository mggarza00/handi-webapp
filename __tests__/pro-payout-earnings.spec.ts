import { describe, expect, it } from "vitest";

import { buildPayoutSeries } from "@/lib/pro/payout-earnings";

describe("pro payout earnings series", () => {
  it("groups paid payouts into the requested periods", () => {
    const now = new Date("2026-04-23T12:00:00.000Z");
    const rows = [
      { paid_at: "2026-04-22T10:00:00.000Z", amount: 950 },
      { paid_at: "2026-04-10T10:00:00.000Z", amount: 475 },
      { paid_at: "2026-03-18T10:00:00.000Z", amount: 300 },
      { paid_at: null, amount: 999 },
    ];

    const week = buildPayoutSeries(rows, "week", now);
    const fortnight = buildPayoutSeries(rows, "fortnight", now);
    const month = buildPayoutSeries(rows, "month", now);

    expect(week.at(-1)).toEqual({ label: "2026-W17", amount: 950 });
    expect(fortnight.at(-1)).toEqual({ label: "2026-04-Q2", amount: 950 });
    expect(fortnight.at(-2)).toEqual({ label: "2026-04-Q1", amount: 475 });
    expect(month.at(-1)).toEqual({ label: "2026-04", amount: 1425 });
    expect(month.at(-2)).toEqual({ label: "2026-03", amount: 300 });
  });
});
