import { describe, expect, it } from "vitest";

import { redactContact, scanContact } from "../lib/safety/contact-guard";

describe("contact-guard", () => {
  it("detecta telefono y correo", () => {
    const result = scanContact("Whats 8123456789 y mail test+ok@mail.com");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.some((entry) => entry.kind === "phone")).toBe(true);
    expect(result.findings.some((entry) => entry.kind === "email")).toBe(true);
  });

  it("redacta datos de contacto", () => {
    const sample = "Tel 81-2345-6789, email a@b.com, calle Reforma 123";
    const result = redactContact(sample);
    expect(result.sanitized).toContain("[bloqueado: telefono]");
    expect(result.sanitized).toContain("[bloqueado: email]");
  });
});
