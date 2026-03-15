import { describe, expect, it } from "vitest";

import {
  buildRatingsAggregateMap,
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

  it("usa fallback legacy cuando no hay reseñas agregadas", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "pro-2", avg: "4.7", count: 0 },
    ]);
    const resolved = resolveProfessionalRating({
      aggregate: map.get("pro-2") ?? null,
      legacyRating: 4.3,
    });
    expect(resolved).toBe(4.3);
  });

  it("ignora filas agregadas inválidas", () => {
    const map = buildRatingsAggregateMap([
      { to_user_id: "pro-3", avg: null, count: 3 },
      { to_user_id: "pro-4", avg: "NaN", count: 4 },
      { to_user_id: "pro-5", avg: 4.9, count: -1 },
    ]);
    expect(map.size).toBe(0);
  });
});
