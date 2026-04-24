import { describe, expect, it } from "vitest";

import {
  isProWorkspacePath,
  shouldShowMobileClientTabbar,
  shouldShowProMobileTabbar,
} from "@/lib/routing/mobile-tabbar-visibility";

describe("mobile tabbar visibility", () => {
  it("shows the client tabbar for a client-only user", () => {
    expect(
      shouldShowMobileClientTabbar({
        isAuth: true,
        effectiveRole: "client",
        isClientPro: false,
        proApply: false,
        pathname: "/",
      }),
    ).toBe(true);
  });

  it("does not show the client tabbar for a pro-only user", () => {
    expect(
      shouldShowMobileClientTabbar({
        isAuth: true,
        effectiveRole: "pro",
        isClientPro: false,
        proApply: false,
        pathname: "/pro",
      }),
    ).toBe(false);
  });

  it("shows the client tabbar for a dual-role user with active client role", () => {
    expect(
      shouldShowMobileClientTabbar({
        isAuth: true,
        effectiveRole: "client",
        isClientPro: true,
        proApply: false,
        pathname: "/",
      }),
    ).toBe(true);
  });

  it("shows the client tabbar for a dual-role user on public routes even with active pro role", () => {
    expect(
      shouldShowMobileClientTabbar({
        isAuth: true,
        effectiveRole: "pro",
        isClientPro: true,
        proApply: false,
        pathname: "/",
      }),
    ).toBe(true);
  });

  it("hides the client tabbar and keeps the pro tabbar on pro workspace routes for dual-role users", () => {
    expect(isProWorkspacePath("/pro")).toBe(true);
    expect(
      shouldShowMobileClientTabbar({
        isAuth: true,
        effectiveRole: "pro",
        isClientPro: true,
        proApply: false,
        pathname: "/pro",
      }),
    ).toBe(false);
    expect(
      shouldShowProMobileTabbar({
        effectiveRole: "pro",
        isClientPro: true,
        pathname: "/pro",
      }),
    ).toBe(true);
  });
});
