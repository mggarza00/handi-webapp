import { describe, it, expect, vi, beforeEach } from "vitest";

import { syncOfferAgreementStatus } from "@/lib/agreements/sync-offer-agreement";

type InsertCall = { table: string; payload: Record<string, unknown> };
type UpdateCall = { table: string; patch: Record<string, unknown> };

let conversationRequestId: string | null = null;
let existingAgreementId: string | null = null;
const insertCalls: InsertCall[] = [];
const updateCalls: UpdateCall[] = [];

const mockAdmin = {
  from(table: string) {
    const query = {
      select() {
        return query;
      },
      eq() {
        return query;
      },
      async maybeSingle() {
        if (table === "conversations") {
          return {
            data: conversationRequestId
              ? { request_id: conversationRequestId }
              : null,
            error: null,
          };
        }
        if (table === "agreements") {
          return {
            data: existingAgreementId ? { id: existingAgreementId } : null,
            error: null,
          };
        }
        return { data: null, error: null };
      },
      update(patch: Record<string, unknown>) {
        updateCalls.push({ table, patch });
        return {
          async eq() {
            return { error: null };
          },
        };
      },
      async insert(payload: Record<string, unknown>) {
        insertCalls.push({ table, payload });
        return { error: null };
      },
    };
    return query;
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  getAdminSupabase: () => mockAdmin,
}));

beforeEach(() => {
  conversationRequestId = null;
  existingAgreementId = null;
  insertCalls.length = 0;
  updateCalls.length = 0;
});

describe("syncOfferAgreementStatus", () => {
  it("falls back to conversation request_id when missing", async () => {
    conversationRequestId = "req-1";
    await syncOfferAgreementStatus({
      offer: {
        request_id: null,
        conversation_id: "conv-1",
        professional_id: "pro-1",
        amount: 1200,
      } as any,
      status: "accepted",
    });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.payload.request_id).toBe("req-1");
    expect(insertCalls[0]?.payload.status).toBe("accepted");
  });

  it("updates to cancelled when rejected", async () => {
    existingAgreementId = "agr-1";
    await syncOfferAgreementStatus({
      offer: {
        request_id: "req-2",
        conversation_id: "conv-2",
        professional_id: "pro-2",
        amount: 500,
      } as any,
      status: "rejected",
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.patch.status).toBe("cancelled");
  });
});
