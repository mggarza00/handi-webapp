import { resolveParticipantProfileIdsFromRows } from "@/lib/onsite/participant-profile-ids";

describe("onsite participant profile ids", () => {
  it("resolves both participant profile ids when rows exist", () => {
    const resolved = resolveParticipantProfileIdsFromRows(
      {
        professionalAuthUserId: "pro-1",
        clientAuthUserId: "client-1",
      },
      [{ id: "pro-1" }, { id: "client-1" }],
    );

    expect(resolved).toEqual({
      professionalProfileId: "pro-1",
      clientProfileId: "client-1",
      missingAuthUserIds: [],
    });
  });

  it("reports missing profile ids explicitly", () => {
    const resolved = resolveParticipantProfileIdsFromRows(
      {
        professionalAuthUserId: "pro-1",
        clientAuthUserId: "client-1",
      },
      [{ id: "client-1" }],
    );

    expect(resolved.professionalProfileId).toBeNull();
    expect(resolved.clientProfileId).toBe("client-1");
    expect(resolved.missingAuthUserIds).toEqual(["pro-1"]);
  });

  it("ignores blank ids safely", () => {
    const resolved = resolveParticipantProfileIdsFromRows(
      {
        professionalAuthUserId: "  ",
        clientAuthUserId: "client-1",
      },
      [{ id: "client-1" }],
    );

    expect(resolved.professionalProfileId).toBeNull();
    expect(resolved.clientProfileId).toBe("client-1");
    expect(resolved.missingAuthUserIds).toEqual([]);
  });
});
