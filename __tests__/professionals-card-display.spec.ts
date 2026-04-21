import { describe, expect, it } from "vitest";

import {
  formatCompletedServicesLabel,
  formatProfessionalRatingWithStar,
} from "@/lib/professionals/card-display";

describe("professional card display helpers", () => {
  it("pluralizes completed services naturally in spanish", () => {
    expect(formatCompletedServicesLabel(0)).toBe("0 servicios realizados");
    expect(formatCompletedServicesLabel(1)).toBe("1 servicio realizado");
    expect(formatCompletedServicesLabel(12)).toBe("12 servicios realizados");
  });

  it("shows rating with star only when a valid value exists", () => {
    expect(formatProfessionalRatingWithStar(4.8)).toBe("4.8 ★");
    expect(formatProfessionalRatingWithStar(5)).toBe("5 ★");
    expect(formatProfessionalRatingWithStar(null)).toBeNull();
    expect(formatProfessionalRatingWithStar(undefined)).toBeNull();
    expect(formatProfessionalRatingWithStar("")).toBeNull();
    expect(formatProfessionalRatingWithStar("nope")).toBeNull();
  });
});
