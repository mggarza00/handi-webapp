import { describe, expect, it } from "vitest";

import { parseAssistantPayload } from "@/lib/assistant/protocol";

describe("assistant stream protocol", () => {
  it("parses text event payload", () => {
    const parsed = parseAssistantPayload(
      JSON.stringify({ type: "text", delta: "Hola" }),
    );
    expect(parsed.type).toBe("text");
    if (parsed.type === "text") {
      expect(parsed.delta).toBe("Hola");
    }
  });

  it("parses actions payload", () => {
    const parsed = parseAssistantPayload(
      JSON.stringify({
        type: "actions",
        actions: [{ type: "app_link", label: "Ir", href: "/help" }],
      }),
    );
    expect(parsed.type).toBe("actions");
    if (parsed.type === "actions") {
      expect(parsed.actions[0]?.href).toBe("/help");
    }
  });

  it("falls back to legacy text when payload is plain text", () => {
    const parsed = parseAssistantPayload("respuesta legacy");
    expect(parsed.type).toBe("legacy_text");
    if (parsed.type === "legacy_text") {
      expect(parsed.delta).toBe("respuesta legacy");
    }
  });
});

