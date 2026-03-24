import { describe, expect, it } from "vitest";

import { resolveHeaderRole } from "@/lib/routing/header-active-role";

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
