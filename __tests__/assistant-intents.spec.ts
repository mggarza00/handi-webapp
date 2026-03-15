import { describe, expect, it } from "vitest";

import {
  matchCanonicalIntent,
  supportFallbackResponse,
} from "@/lib/assistant/intents";

describe("assistant canonical intents", () => {
  it("matches create request intent with deterministic response and actions", () => {
    const match = matchCanonicalIntent(
      "¿Cómo hago una solicitud de servicio?",
      "client",
    );
    expect(match?.id).toBe("create_request");
    expect(match?.response.toLowerCase()).toContain("nueva solicitud");
    expect(match?.actions.some((a) => a.href === "/requests/new")).toBe(true);
  });

  it("matches chat locked intent", () => {
    const match = matchCanonicalIntent(
      "No puedo enviar mensajes, sale candado",
      "pro",
    );
    expect(match?.id).toBe("chat_locked");
    expect(match?.actions.some((a) => a.href === "/mensajes")).toBe(true);
  });

  it("returns null for unknown intent", () => {
    const match = matchCanonicalIntent("dime un poema del mar", "client");
    expect(match).toBeNull();
  });

  it("fallback response points to whatsapp", () => {
    const fallback = supportFallbackResponse();
    expect(fallback.actions.some((a) => a.type === "whatsapp")).toBe(true);
  });
});
