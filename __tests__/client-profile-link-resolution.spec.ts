import { describe, expect, it } from "vitest";

import {
  buildClientProfilePath,
  normalizeClientProfileId,
  resolveRequestClientProfileId,
} from "@/lib/clients/client-profile-link";

describe("client profile link resolution", () => {
  it("prefers request client_id over created_by when building the public client link", () => {
    expect(
      resolveRequestClientProfileId({
        requestClientId: "client-profile-1",
        createdBy: "auth-user-1",
      }),
    ).toBe("client-profile-1");
    expect(
      buildClientProfilePath({
        requestClientId: "client-profile-1",
        createdBy: "auth-user-1",
      }),
    ).toBe("/clients/client-profile-1");
  });

  it("prefers an already resolved client profile id above request ids", () => {
    expect(
      buildClientProfilePath({
        clientProfileId: "client-profile-9",
        requestClientId: "client-profile-1",
        createdBy: "auth-user-1",
      }),
    ).toBe("/clients/client-profile-9");
  });

  it("normalizes blank values safely", () => {
    expect(normalizeClientProfileId("   ")).toBeNull();
    expect(
      buildClientProfilePath({
        requestClientId: "   ",
        createdBy: null,
      }),
    ).toBeNull();
  });
});
