import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import MobileClientTabbarButtons from "@/components/mobile-client-tabbar.client";

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
