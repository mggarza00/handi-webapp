import { describe, expect, it } from "vitest";

import {
  resolveHeaderRole,
  shouldHideClientNavigationForProApply,
  shouldShowClientNavigation,
} from "@/lib/routing/header-active-role";

describe("resolveHeaderRole", () => {
  it("keeps client header when active_role cookie is client", () => {
    const role = resolveHeaderRole({
      isAuth: true,
      activeRoleCookie: "client",
      profileRole: "pro",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(role).toBe("client");
  });

  it("switches back to pro header when active_role cookie is pro", () => {
    const role = resolveHeaderRole({
      isAuth: true,
      activeRoleCookie: "pro",
      profileRole: "pro",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(role).toBe("pro");
  });

  it("admin profile collapses to client header when active_role is client", () => {
    const role = resolveHeaderRole({
      isAuth: true,
      activeRoleCookie: "client",
      profileRole: "admin",
      isClientPro: false,
      professionalIsActive: false,
    });
    expect(role).toBe("client");
  });

  it("admin profile can resolve to pro header when pro capability is active", () => {
    const role = resolveHeaderRole({
      isAuth: true,
      activeRoleCookie: "pro",
      profileRole: "admin",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(role).toBe("pro");
  });
});

describe("shouldShowClientNavigation", () => {
  it("shows client nav for dual-role users on active_role=client even with stale pro_apply cookie", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: true,
        activeRoleCookie: "client",
        profileRole: "pro",
        isClientPro: true,
        professionalIsActive: true,
        proApply: true,
      }),
    ).toBe(true);
  });

  it("hides client nav when pro_apply is active and the user is not yet dual-role capable", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: true,
        activeRoleCookie: "client",
        profileRole: "client",
        isClientPro: false,
        professionalIsActive: false,
        proApply: true,
      }),
    ).toBe(false);
  });
});

describe("shouldHideClientNavigationForProApply", () => {
  it("treats pro_apply as stale once the user has active professional capability", () => {
    expect(
      shouldHideClientNavigationForProApply({
        isAuth: true,
        activeRoleCookie: "client",
        profileRole: "pro",
        isClientPro: true,
        professionalIsActive: true,
        proApply: true,
      }),
    ).toBe(false);
  });
});
