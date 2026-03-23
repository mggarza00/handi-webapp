import { describe, expect, it } from "vitest";

import { resolveHeaderRole } from "@/lib/routing/header-active-role";

describe("resolveHeaderRole", () => {
  it("keeps client header when active_role cookie is client", () => {
    const role = resolveHeaderRole({
      isAuth: true,
      isAdmin: false,
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
      isAdmin: false,
      activeRoleCookie: "pro",
      profileRole: "pro",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(role).toBe("pro");
  });

  it("preserves admin header regardless of active_role cookie", () => {
    const role = resolveHeaderRole({
      isAuth: true,
      isAdmin: true,
      activeRoleCookie: "client",
      profileRole: "pro",
      isClientPro: true,
      professionalIsActive: true,
    });
    expect(role).toBe("admin");
  });
});
