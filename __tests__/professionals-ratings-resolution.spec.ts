import { describe, expect, it, vi } from "vitest";

import {
  buildRatingsAggregateMap,
  fetchRatingsAggregateMap,
  normalizeProfessionalRating,
  resolveProfessionalRatingData,
} from "@/lib/professionals/ratings";

describe("professionals rating resolution", () => {
  it("returns the correct average and reviews count from ratings rows", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "user-1", stars: 5 },
      { to_user_id: "user-1", stars: 4 },
      { to_user_id: "user-2", stars: 3 },
    ]);

    expect(map.get("user-1")).toEqual({
      ratingAvg: 4.5,
      reviewsCount: 2,
    });
    expect(map.get("user-2")).toEqual({
      ratingAvg: 3,
      reviewsCount: 1,
    });
  });

  it("uses legacy rating fallback when there are no aggregated ratings", () => {
    const resolved = resolveProfessionalRatingData({
      aggregateMap: new Map(),
      entityId: "pro-1",
      legacyRating: 4.3,
    });

    expect(resolved).toEqual({
      rating: 4.3,
      reviewsCount: 0,
    });
  });

  it("resolves ratings by ratingTargetId when professional.id differs from user_id", () => {
    const aggregateMap = buildRatingsAggregateMap([
      { to_user_id: "user-42", stars: 5 },
      { to_user_id: "user-42", stars: 5 },
    ]);
    const resolved = resolveProfessionalRatingData({
      aggregateMap,
      entityId: "professional-abc",
      ratingTargetId: "user-42",
      legacyRating: null,
    });

    expect(resolved).toEqual({
      rating: 5,
      reviewsCount: 2,
    });
  });

  it("normalizes numeric rating values safely", () => {
    expect(normalizeProfessionalRating(5)).toBe(5);
    expect(normalizeProfessionalRating("5")).toBe(5);
    expect(normalizeProfessionalRating("5.0")).toBe(5);
    expect(normalizeProfessionalRating("abc")).toBeNull();
    expect(normalizeProfessionalRating(null)).toBeNull();
  });

  it("fetches ratings using to_user_id and aggregates them into the final map", async () => {
    const select = vi.fn().mockReturnThis();
    const inFn = vi.fn().mockResolvedValue({
      data: [
        { to_user_id: "user-1", stars: 5 },
        { to_user_id: "user-1", stars: 4 },
      ],
      error: null,
    });
    const from = vi.fn(() => ({
      select,
      in: inFn,
    }));
    const supabase = { from } as unknown as Parameters<
      typeof fetchRatingsAggregateMap
    >[0];

    const map = await fetchRatingsAggregateMap(supabase, [
      "user-1",
      "user-1",
      "user-2",
    ]);

    expect(from).toHaveBeenCalledWith("ratings");
    expect(select).toHaveBeenCalledWith("to_user_id, stars");
    expect(inFn).toHaveBeenCalledWith("to_user_id", ["user-1", "user-2"]);
    expect(map.get("user-1")).toEqual({
      ratingAvg: 4.5,
      reviewsCount: 2,
    });
  });
});
