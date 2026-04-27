import { describe, expect, it, vi } from "vitest";

import {
  buildRatingsAggregateFromStars,
  buildRatingsAggregateMap,
  fetchRatingsAggregateMap,
  getProfessionalRatingSummary,
  getUserRatingSummary,
  normalizeProfessionalRating,
  resolveProfessionalRatingData,
} from "@/lib/professionals/ratings";

type MinimalSupabaseClient = {
  from: (table: string) => {
    select: (query: string) => {
      in: (
        column: string,
        values: string[],
      ) => Promise<{
        data: Array<{ to_user_id: string; stars: number }>;
        error: null;
      }>;
    };
  };
};

describe("professionals rating resolution", () => {
  it("builds aggregates from raw ratings rows", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "user-1", stars: 5 },
      { to_user_id: "user-1", stars: 4 },
      { to_user_id: "user-2", stars: 3 },
    ]);

    expect(map.get("user-1")).toEqual({ ratingAvg: 4.5, reviewsCount: 2 });
    expect(map.get("user-2")).toEqual({ ratingAvg: 3, reviewsCount: 1 });
  });

  it("also supports pre-aggregated rows", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "user-1", avg: "4.75", count: "4" },
    ]);

    expect(map.get("user-1")).toEqual({ ratingAvg: 4.8, reviewsCount: 4 });
  });

  it("ignores invalid aggregate rows", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "pro-3", avg: null, count: 3 },
      { to_user_id: "pro-4", avg: "NaN", count: 4 },
      { to_user_id: "pro-5", avg: 4.9, count: -1 },
    ]);

    expect(map.size).toBe(0);
  });

  it("uses ratingTargetId to resolve canonical rating data", () => {
    const aggregateMap = buildRatingsAggregateMap([
      { to_user_id: "canonical-user", stars: 5 },
      { to_user_id: "canonical-user", stars: 5 },
    ]);

    expect(
      resolveProfessionalRatingData({
        aggregateMap,
        legacyRating: 3.2,
        professionalId: "professional-1",
        ratingTargetId: "canonical-user",
      }),
    ).toEqual({ rating: 5, reviewsCount: 2 });
  });

  it("resolves ratings by mapped ratingTargetId when professional.id differs from user_id", () => {
    const aggregateMap = buildRatingsAggregateMap([
      { to_user_id: "user-42", stars: 5 },
      { to_user_id: "user-42", stars: 5 },
    ]);
    const ratingTargetMap = new Map([["professional-abc", "user-42"]]);

    const resolved = resolveProfessionalRatingData({
      aggregateMap,
      professionalId: "professional-abc",
      ratingTargetMap,
      legacyRating: null,
    });

    expect(resolved).toEqual({
      rating: 5,
      reviewsCount: 2,
    });
  });

  it("uses ratingTargetMap when professional id differs from the canonical user id", () => {
    const aggregateMap = buildRatingsAggregateMap([
      { to_user_id: "canonical-user", stars: 5 },
      { to_user_id: "canonical-user", stars: 4 },
    ]);

    const resolved = resolveProfessionalRatingData({
      aggregateMap,
      professionalId: "professional-row",
      ratingTargetMap: new Map([["professional-row", "canonical-user"]]),
      legacyRating: null,
    });

    expect(resolved).toEqual({
      rating: 4.5,
      reviewsCount: 2,
    });
  });

  it("falls back to legacy rating when canonical reviews are missing", () => {
    expect(
      resolveProfessionalRatingData({
        aggregateMap: new Map(),
        legacyRating: 4.3,
        professionalId: "professional-1",
        ratingTargetId: "canonical-user",
      }),
    ).toEqual({ rating: 4.3, reviewsCount: 0 });
  });

  it("normalizes professional rating values safely", () => {
    expect(normalizeProfessionalRating("4.84")).toBe(4.8);
    expect(normalizeProfessionalRating(5)).toBe(5);
    expect(normalizeProfessionalRating("5")).toBe(5);
    expect(normalizeProfessionalRating(undefined)).toBeNull();
    expect(normalizeProfessionalRating(-1)).toBeNull();
    expect(normalizeProfessionalRating("NaN")).toBeNull();
  });

  it("fetches canonical rating aggregates from ratings.to_user_id", async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [
        { to_user_id: "user-1", stars: 5 },
        { to_user_id: "user-1", stars: 4 },
      ],
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ in: inMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    const supabase = { from: fromMock } as unknown as MinimalSupabaseClient;

    const result = await fetchRatingsAggregateMap(supabase, [
      "user-1",
      "user-1",
      "user-2",
    ]);

    expect(fromMock).toHaveBeenCalledWith("ratings");
    expect(selectMock).toHaveBeenCalledWith("to_user_id, stars");
    expect(inMock).toHaveBeenCalledWith("to_user_id", ["user-1", "user-2"]);
    expect(result.get("user-1")).toEqual({ ratingAvg: 4.5, reviewsCount: 2 });
  });

  it("calculates average and count from individual stars rows", () => {
    const aggregate = buildRatingsAggregateFromStars([
      { stars: 5 },
      { stars: "4" },
      { stars: 4.2 },
    ]);

    expect(aggregate).toEqual({
      ratingAvg: 4.4,
      reviewsCount: 3,
    });
  });

  it("discards invalid individual star rows", () => {
    const aggregate = buildRatingsAggregateFromStars([
      { stars: null },
      { stars: "NaN" },
      {},
    ]);

    expect(aggregate).toBeNull();
  });

  it("reads the professional rating summary from to_user_id when available", async () => {
    const supabase: Parameters<typeof getProfessionalRatingSummary>[0] = {
      from() {
        return {
          select() {
            return {
              async eq(column: string) {
                if (column === "to_user_id") {
                  return {
                    data: [{ stars: 5 }, { stars: 5 }],
                    count: 2,
                    error: null,
                  };
                }
                return {
                  data: [],
                  count: 0,
                  error: { message: "should not reach fallback" },
                };
              },
            };
          },
        };
      },
    };

    await expect(
      getProfessionalRatingSummary(supabase, "pro-1"),
    ).resolves.toEqual({
      average: 5,
      count: 2,
    });
  });

  it("reads a client rating summary from to_user_id without depending on profiles.rating", async () => {
    const supabase: Parameters<typeof getUserRatingSummary>[0] = {
      from() {
        return {
          select() {
            return {
              async eq(column: string) {
                if (column === "to_user_id") {
                  return {
                    data: [{ stars: 5 }, { stars: 4 }],
                    count: 2,
                    error: null,
                  };
                }
                return {
                  data: [],
                  count: 0,
                  error: null,
                };
              },
            };
          },
        };
      },
    };

    await expect(
      getUserRatingSummary(supabase, "client-user-1"),
    ).resolves.toEqual({
      average: 4.5,
      count: 2,
    });
  });

  it("falls back to professional_id when to_user_id returns no rows", async () => {
    const supabase: Parameters<typeof getProfessionalRatingSummary>[0] = {
      from() {
        return {
          select() {
            return {
              async eq(column: string) {
                if (column === "to_user_id") {
                  return {
                    data: [],
                    count: 0,
                    error: null,
                  };
                }
                if (column === "professional_id") {
                  return {
                    data: [{ stars: 5 }, { stars: 4 }],
                    count: 2,
                    error: null,
                  };
                }
                return {
                  data: [],
                  count: 0,
                  error: null,
                };
              },
            };
          },
        };
      },
    };

    await expect(
      getProfessionalRatingSummary(supabase, "pro-legacy"),
    ).resolves.toEqual({
      average: 4.5,
      count: 2,
    });
  });
});
