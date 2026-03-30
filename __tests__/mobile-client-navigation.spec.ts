import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import MobileClientTabbarButtons from "@/components/mobile-client-tabbar.client";
import { shouldShowClientNavigation } from "@/lib/routing/header-active-role";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", props),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/components/requests/CreateRequestButton", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("button", props, children),
}));

describe("shouldShowClientNavigation", () => {
  it("keeps client navigation hidden for unauthenticated users", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: false,
        activeRoleCookie: "client",
        profileRole: "client",
        isClientPro: false,
        professionalIsActive: false,
        proApply: false,
      }),
    ).toBe(false);
  });

  it("shows client navigation for a pure client user", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: true,
        activeRoleCookie: null,
        profileRole: "client",
        isClientPro: false,
        professionalIsActive: false,
        proApply: false,
      }),
    ).toBe(true);
  });

  it("hides client navigation for a pro user", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: true,
        activeRoleCookie: null,
        profileRole: "pro",
        isClientPro: false,
        professionalIsActive: true,
        proApply: false,
      }),
    ).toBe(false);
  });

  it("shows client navigation for a dual user with active_role=client", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: true,
        activeRoleCookie: "client",
        profileRole: "pro",
        isClientPro: true,
        professionalIsActive: true,
        proApply: false,
      }),
    ).toBe(true);
  });

  it("hides client navigation for a dual user with active_role=pro", () => {
    expect(
      shouldShowClientNavigation({
        isAuth: true,
        activeRoleCookie: "pro",
        profileRole: "pro",
        isClientPro: true,
        professionalIsActive: true,
        proApply: false,
      }),
    ).toBe(false);
  });

  it("hides client navigation when pro apply is active", () => {
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

describe("MobileClientTabbarButtons", () => {
  it("renders both mobile client actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileClientTabbarButtons),
    );

    expect(html).toContain("Mis solicitudes");
    expect(html).toContain("Nueva solicitud");
    expect(html).toContain("/requests?mine=1");
  });
});
