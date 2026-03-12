import { describe, expect, it } from "vitest";

import {
  EXPIRED_AUTH_LINK_MESSAGE,
  SIGNUP_CONFIRMATION_MESSAGE,
  getLoginErrorPresentation,
  isExpiredOrUsedAuthLink,
} from "@/lib/auth/flow";

describe("auth flow messaging", () => {
  it("maps invalid login credentials to friendly message and recovery actions", () => {
    const result = getLoginErrorPresentation("Invalid login credentials");
    expect(result.message).toBe(
      "La contrasena es incorrecta o tu cuenta aun no esta confirmada.",
    );
    expect(result.showRecoveryActions).toBe(true);
  });

  it("keeps signup confirmation copy with inbox/spam/promotions guidance", () => {
    expect(SIGNUP_CONFIRMATION_MESSAGE.toLowerCase()).toContain("bandeja");
    expect(SIGNUP_CONFIRMATION_MESSAGE.toLowerCase()).toContain("spam");
    expect(SIGNUP_CONFIRMATION_MESSAGE.toLowerCase()).toContain("promociones");
  });

  it("detects expired or used callback link errors", () => {
    const expired = isExpiredOrUsedAuthLink({
      status: "400",
      code: "otp_expired",
      error: "Token has expired",
    });
    expect(expired).toBe(true);
    expect(EXPIRED_AUTH_LINK_MESSAGE).toBe("Este enlace expiro o ya fue usado.");
  });
});
