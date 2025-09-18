import { afterEach, describe, expect, it } from "vitest";

import { validateOfferFields } from "../lib/safety/offer-guard";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CONTACT_POLICY;
  delete process.env.NEXT_PUBLIC_CONTACT_POLICY_MESSAGE;
});

describe("offer-guard", () => {
  it("bloquea contacto en title/description (block)", () => {
    process.env.NEXT_PUBLIC_CONTACT_POLICY = "block";
    const result = validateOfferFields({
      title: "Llamame 81 1234 5678",
      description: "correo a@b.com",
    });
    expect(result.ok).toBe(false);
  });

  it("redacta cuando policy=redact", () => {
    process.env.NEXT_PUBLIC_CONTACT_POLICY = "redact";
    console.log("policy env before call", process.env.NEXT_PUBLIC_CONTACT_POLICY);
    const result = validateOfferFields({
      title: "a@b.com",
      description: "Calle Falsa 123 CP 64000",
    });
    console.log("offer guard redact", result);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.title).not.toMatch(/@/);
    }
  });
});
