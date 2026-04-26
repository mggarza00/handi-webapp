import { describe, expect, it } from "vitest";

import {
  isClientRole,
  isOpenRequestStatus,
  isRequestCompatibleWithProfessional,
  toCompatibleRequestSummary,
} from "@/lib/profiles/hire";

const professional = {
  id: "pro-1",
  userId: "user-1",
  name: "Profesional Uno",
  cities: ["Monterrey", "San Pedro Garza García"],
  categories: ["Plomería", "Electricidad"],
  subcategories: ["Fugas", "Instalaciones"],
};

describe("profile hire compatibility", () => {
  it("matches exact normalized city and category when request has no subcategory", () => {
    expect(
      isRequestCompatibleWithProfessional({
        professional,
        request: {
          id: "req-1",
          city: "san pedro garza garcia",
          category: "plomeria",
          status: "active",
        },
      }),
    ).toBe(true);
  });

  it("requires subcategory overlap when both request and professional have subcategories", () => {
    expect(
      isRequestCompatibleWithProfessional({
        professional,
        request: {
          id: "req-2",
          city: "Monterrey",
          category: "Plomería",
          subcategory: "Fugas",
          status: "active",
        },
      }),
    ).toBe(true);

    expect(
      isRequestCompatibleWithProfessional({
        professional,
        request: {
          id: "req-3",
          city: "Monterrey",
          category: "Plomería",
          subcategory: "Impermeabilización",
          status: "active",
        },
      }),
    ).toBe(false);
  });

  it("treats request status active as open and preserves summary fields", () => {
    const request = {
      id: "req-4",
      title: "Reparar fuga en baño",
      city: "Monterrey",
      category: "Plomería",
      subcategories: [{ name: "Fugas" }],
      status: "active",
      created_at: "2026-04-25T12:00:00.000Z",
    };

    expect(isOpenRequestStatus(request.status)).toBe(true);
    expect(toCompatibleRequestSummary(request)).toEqual({
      id: "req-4",
      title: "Reparar fuga en baño",
      city: "Monterrey",
      category: "Plomería",
      subcategory: "Fugas",
      status: "active",
      createdAt: "2026-04-25T12:00:00.000Z",
    });
  });

  it("allows client-pro viewers to hire but blocks non-client roles", () => {
    expect(isClientRole({ role: "client", isClientPro: false })).toBe(true);
    expect(isClientRole({ role: "pro", isClientPro: true })).toBe(true);
    expect(isClientRole({ role: "pro", isClientPro: false })).toBe(false);
  });
});
