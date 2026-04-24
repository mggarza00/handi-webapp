import { beforeEach, describe, expect, it, vi } from "vitest";

type RatingsResponse = {
  data: Array<{ stars: number }>;
  count: number;
  error: null;
};

type ProfileResponse = {
  data: { rating: number | null } | null;
  error: null;
};

type ProfessionalResponse = {
  data: { id: string; user_id: string } | null;
  error: null;
};

type CountResponse = {
  count: number;
  error: null;
};

type PayoutRow = {
  paid_at: string | null;
  created_at: string | null;
  amount: number | null;
  status: string | null;
  professional_id: string;
};

function createStatsClient(args: {
  ratingsByToUser?: RatingsResponse;
  ratingsByProfessional?: RatingsResponse;
  profile?: ProfileResponse;
  professional?: ProfessionalResponse;
  payouts?: PayoutRow[];
}) {
  return {
    from(table: string) {
      return {
        select(_query: string, _options?: { head?: boolean; count?: "exact" }) {
          if (table === "profiles") {
            return {
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue(
                  args.profile ?? {
                    data: { rating: null },
                    error: null,
                  },
                ),
              }),
            };
          }

          if (table === "professionals") {
            return {
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue(
                  args.professional ?? {
                    data: null,
                    error: null,
                  },
                ),
              }),
            };
          }

          if (table === "ratings") {
            return {
              eq: async (column: string) => {
                if (column === "to_user_id") {
                  return (
                    args.ratingsByToUser ?? {
                      data: [],
                      count: 0,
                      error: null,
                    }
                  );
                }
                if (column === "professional_id") {
                  return (
                    args.ratingsByProfessional ?? {
                      data: [],
                      count: 0,
                      error: null,
                    }
                  );
                }
                return {
                  data: [],
                  count: 0,
                  error: null,
                };
              },
            };
          }

          if (table === "pro_calendar_events") {
            return {
              eq: () => ({
                in: async () => ({ count: 0, error: null }) as CountResponse,
              }),
            };
          }

          if (table === "agreements") {
            return {
              eq: () => ({
                in: async () => ({ count: 0, error: null }) as CountResponse,
                eq: async () => ({ count: 0, error: null }) as CountResponse,
              }),
            };
          }

          if (table === "payouts") {
            return {
              in: () => ({
                in: () => ({
                  order: async () => ({
                    data: args.payouts ?? [],
                    error: null,
                  }),
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      };
    },
  };
}

describe("pro stats", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("prefers admin metrics when the SSR client returns empty results", async () => {
    const serverClient = createStatsClient({});
    const adminClient = createStatsClient({
      ratingsByToUser: {
        data: [{ stars: 5 }, { stars: 5 }],
        count: 2,
        error: null,
      },
      payouts: [
        {
          professional_id: "574765b2-2464-4abf-88ba-dfb8aef15f55",
          amount: 1900,
          status: "paid",
          paid_at: "2026-04-24T01:00:39.388+00:00",
          created_at: "2026-04-24T01:00:39.847424+00:00",
        },
      ],
    });

    vi.doMock("@/lib/db/requests", () => ({
      fetchExploreRequests: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
    }));
    vi.doMock("@/lib/supabase/admin", () => ({
      getAdminSupabase: () => adminClient,
    }));
    vi.doMock("@/lib/supabase/server-client", () => ({
      default: () => serverClient,
    }));

    const { getTotals } = await import("@/lib/pro/stats");
    const totals = await getTotals("574765b2-2464-4abf-88ba-dfb8aef15f55");

    expect(totals.avg_rating).toBe(5);
    expect(totals.earnings_week).toBe(1900);
    expect(totals.earnings_fortnight).toBe(1900);
    expect(totals.earnings_month).toBe(1900);
  });
});
