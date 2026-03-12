import { describe, expect, it, vi } from "vitest";

import {
  RESEND_CONFIRMATION_ENDPOINT,
  requestResendConfirmation,
} from "@/components/auth/recovery-actions";

describe("requestResendConfirmation", () => {
  it("calls resend endpoint and returns success feedback", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBe(RESEND_CONFIRMATION_ENDPOINT);
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: "Correo reenviado",
        }),
      } as Response;
    });

    const result = await requestResendConfirmation(
      "cliente@ejemplo.com",
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Correo reenviado");
  });

  it("returns friendly error when endpoint fails", async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: false,
        json: async () => ({
          success: false,
          message: "Espera unos minutos",
        }),
      } as Response;
    });

    const result = await requestResendConfirmation(
      "cliente@ejemplo.com",
      fetchMock as unknown as typeof fetch,
    );

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Espera unos minutos");
  });
});
