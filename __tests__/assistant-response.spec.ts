import { describe, expect, it } from "vitest";

import {
  sanitizeActions,
  sanitizeAssistantText,
} from "@/lib/assistant/response";

describe("assistant response sanitization", () => {
  it("removes technical routes and uuids from text", () => {
    const text =
      "Abre /requests/123e4567-e89b-12d3-a456-426614174000 para continuar. Luego revisa /requests/:id.";
    const sanitized = sanitizeAssistantText(text);
    expect(sanitized.includes("123e4567")).toBe(false);
    expect(sanitized.includes("/:id")).toBe(false);
  });

  it("keeps only safe actions", () => {
    const actions = sanitizeActions([
      { type: "app_link", label: "Hack", href: "/admin/secret" },
      { type: "app_link", label: "Ayuda", href: "/help" },
      { type: "whatsapp", label: "WA", href: "https://wa.me/528130878691" },
      { type: "external_link", label: "Bad", href: "https://malicious.example" },
    ]);
    expect(actions.some((a) => a.href === "/admin/secret")).toBe(false);
    expect(actions.some((a) => a.href === "/help")).toBe(true);
    expect(actions.some((a) => a.href.includes("wa.me"))).toBe(true);
    expect(actions.some((a) => a.href.includes("malicious.example"))).toBe(false);
  });
});

