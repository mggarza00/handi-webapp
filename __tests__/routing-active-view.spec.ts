import { describe, expect, it } from "vitest";

import {
  canAccessProHome,
  getDefaultHomeForActiveRole,
  resolveActiveView,
} from "@/lib/routing/active-view";

describe("resolveActiveView", () => {
  it("defaults to pro when cookie is missing and dual user has active professional", () => {
    const view = resolveActiveView({
      activeRoleCookie: null,
      profileRole: "client",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(view).toBe("pro");
    expect(getDefaultHomeForActiveRole(view)).toBe("/pro");
  });

  it("defaults to pro when cookie is missing and profile role is pro with active professional", () => {
    const view = resolveActiveView({
      activeRoleCookie: null,
      profileRole: "pro",
      isClientPro: false,
      professionalIsActive: true,
    });
    expect(view).toBe("pro");
    expect(getDefaultHomeForActiveRole(view)).toBe("/pro");
  });

  it("respects cookie client for active dual user", () => {
    const view = resolveActiveView({
      activeRoleCookie: "client",
      profileRole: "pro",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(view).toBe("client");
    expect(getDefaultHomeForActiveRole(view)).toBe("/");
  });

  it("respects cookie pro for active dual user", () => {
    const view = resolveActiveView({
      activeRoleCookie: "pro",
      profileRole: "client",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(view).toBe("pro");
    expect(getDefaultHomeForActiveRole(view)).toBe("/pro");
  });

  it("blocks pro home when cookie says pro but professional is inactive", () => {
    const input = {
      activeRoleCookie: "pro",
      profileRole: "pro",
      isClientPro: true,
      professionalIsActive: false,
    } as const;
    expect(resolveActiveView(input)).toBe("client");
    expect(getDefaultHomeForActiveRole(resolveActiveView(input))).toBe("/");
    expect(canAccessProHome(input)).toBe(false);
  });
});
