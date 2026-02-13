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

  it("detecta telefono con palabras", () => {
    const sample = "Llamame al ocho uno ocho uno seis once nueve cero dos";
    const result = scanContact(sample);
    expect(result.findings.some((entry) => entry.kind === "phone")).toBe(true);
  });

  it("detecta telefono mixto palabras y digitos", () => {
    const sample = "Mi cel es 8 uno 8 dos trestres 9 0 1 2";
    const result = scanContact(sample);
    expect(result.findings.some((entry) => entry.kind === "phone")).toBe(true);
  });

  it("detecta email", () => {
    const result = scanContact("correo test@example.com para contacto");
    expect(result.findings.some((entry) => entry.kind === "email")).toBe(true);
  });

  it("detecta direccion", () => {
    const result = scanContact("Calle Juárez 123, Col. Centro, CP 64000");
    expect(result.findings.some((entry) => entry.kind === "address")).toBe(
      true,
    );
  });
});
