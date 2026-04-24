import { describe, expect, it } from "vitest";

import {
  buildRatingsAggregateFromStars,
  buildRatingsAggregateMap,
  getProfessionalRatingSummary,
  resolveProfessionalRating,
} from "@/lib/professionals/ratings";

describe("professionals rating resolution", () => {
  it("prefiere rating agregado real sobre rating legacy", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "pro-1", avg: "4.0", count: "2" },
    ]);
    const resolved = resolveProfessionalRating({
      aggregate: map.get("pro-1") ?? null,
      legacyRating: 3.4,
    });
    expect(resolved).toBe(4);
    expect(map.get("pro-1")?.reviewsCount).toBe(2);
  });

  it("usa fallback legacy cuando no hay resenas agregadas", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "pro-2", avg: "4.7", count: 0 },
    ]);
    const resolved = resolveProfessionalRating({
      aggregate: map.get("pro-2") ?? null,
      legacyRating: 4.3,
    });
    expect(resolved).toBe(4.3);
  });

  it("ignora filas agregadas invalidas", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "pro-3", avg: null, count: 3 },
      { to_user_id: "pro-4", avg: "NaN", count: 4 },
      { to_user_id: "pro-5", avg: 4.9, count: -1 },
    ]);
    expect(map.size).toBe(0);
  });

  it("calcula promedio y conteo desde filas individuales", () => {
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

  it("descarta filas individuales invalidas", () => {
    const aggregate = buildRatingsAggregateFromStars([
      { stars: null },
      { stars: "NaN" },
      {},
    ]);

    expect(aggregate).toBeNull();
  });

  it("lee el resumen desde to_user_id cuando existe", async () => {
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
});
