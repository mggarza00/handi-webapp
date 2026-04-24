import { findOnsiteRequestBlocker } from "@/lib/onsite/request-blockers";

describe("onsite request blockers", () => {
  it("blocks when an active onsite request already exists in the chat", () => {
    const result = findOnsiteRequestBlocker([
      {
        id: "onsite-1",
        conversation_id: "conv-1",
        request_id: "req-1",
        status: "deposit_pending",
        is_remunerable: true,
        remuneration_applied_at: null,
      },
    ]);

    expect(result?.code).toBe("ONSITE_ACTIVE_REQUEST_EXISTS");
    expect(result?.blocker.id).toBe("onsite-1");
    expect(result?.blocker.status).toBe("deposit_pending");
  });

  it("blocks with eligible credit only when deposit was paid, remunerable and still unapplied", () => {
    const result = findOnsiteRequestBlocker([
      {
        id: "onsite-2",
        conversation_id: "conv-2",
        request_id: "req-2",
        status: "deposit_paid",
        is_remunerable: true,
        remuneration_applied_at: null,
      },
    ]);

    expect(result?.code).toBe("ONSITE_ELIGIBLE_CREDIT_EXISTS");
    expect(result?.blocker.id).toBe("onsite-2");
  });

  it("does not block when the remunerable credit was already applied", () => {
    const result = findOnsiteRequestBlocker([
      {
        id: "onsite-3",
        conversation_id: "conv-3",
        request_id: "req-3",
        status: "deposit_paid",
        is_remunerable: true,
        remuneration_applied_at: "2026-04-10T18:00:00.000Z",
      },
    ]);

    expect(result).toBeNull();
  });
});
