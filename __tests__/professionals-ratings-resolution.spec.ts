import { describe, expect, it, vi } from "vitest";

import {
  buildRatingsAggregateMap,
  fetchRatingsAggregateMap,
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

    const result = await fetchRatingsAggregateMap(supabase, ["user-1"]);

    expect(fromMock).toHaveBeenCalledWith("ratings");
    expect(selectMock).toHaveBeenCalledWith("to_user_id, stars");
    expect(inMock).toHaveBeenCalledWith("to_user_id", ["user-1"]);
    expect(result.get("user-1")).toEqual({ ratingAvg: 4.5, reviewsCount: 2 });
  });
});
