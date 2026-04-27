import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  notifyChatMessageByConversation: vi.fn(),
  notifyAdminsInApp: vi.fn(),
  notifyAdminsEmail: vi.fn(),
  recordPayment: vi.fn(),
  getProfessionalPayoutCommissionPercent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/chat-notifier", () => ({
  notifyChatMessageByConversation: mocks.notifyChatMessageByConversation,
}));

vi.mock("@/lib/admin/admin-notify", () => ({
  notifyAdminsInApp: mocks.notifyAdminsInApp,
  notifyAdminsEmail: mocks.notifyAdminsEmail,
}));

vi.mock("@/lib/payments/record-payment", () => ({
  recordPayment: mocks.recordPayment,
}));

vi.mock("@/lib/payouts/manual", () => ({
  getProfessionalPayoutCommissionPercent:
    mocks.getProfessionalPayoutCommissionPercent,
  computeProfessionalPayoutBreakdown: (grossAmount: number, percent = 5) => ({
    grossAmount,
    commissionAmount: Number((grossAmount * percent) / 100),
    commissionPercent: percent,
    netAmount: Number(grossAmount - (grossAmount * percent) / 100),
  }),
}));

import { finalizeOnsiteDepositPayment } from "@/lib/payments/finalize-onsite-deposit-payment";

type FakeState = {
  onsite: {
    id: string;
    conversation_id: string | null;
    request_id: string | null;
    professional_id: string | null;
    client_id: string | null;
    status: string | null;
    is_remunerable: boolean | null;
    deposit_amount: number | null;
    deposit_payment_intent_id: string | null;
    deposit_paid_at: string | null;
    deposit_base_cents: number | null;
    deposit_fee_cents: number | null;
    deposit_iva_cents: number | null;
    deposit_total_cents: number | null;
    schedule_date: string | null;
    schedule_time_start: number | null;
    schedule_time_end: number | null;
  };
  conversation: {
    id: string;
    request_id: string | null;
    customer_id: string | null;
    pro_id: string | null;
  };
  request: {
    id: string;
    title: string | null;
  };
  profiles: Array<{
    id: string;
    full_name: string | null;
  }>;
  notifications: Array<Record<string, unknown>>;
  calendar: Array<Record<string, unknown>>;
};

function createFakeAdmin(state: FakeState) {
  return {
    from(table: string) {
      let mode: "select" | "update" | "insert" | "upsert" = "select";
      let updatePayload: Record<string, unknown> | null = null;
      let insertPayload: Record<string, unknown> | null = null;
      let upsertPayload: Record<string, unknown> | null = null;
      const filters: Array<{
        op: "eq" | "neq";
        column: string;
        value: unknown;
      }> = [];
      const inFilters: Array<{
        column: string;
        values: unknown[];
      }> = [];

      const matches = (row: Record<string, unknown> | null) =>
        Boolean(row) &&
        filters.every((filter) => {
          const current = row?.[filter.column];
          return filter.op === "eq"
            ? current === filter.value
            : current !== filter.value;
        }) &&
        inFilters.every((filter) =>
          filter.values.includes(row?.[filter.column] as never),
        );

      const getSingleRow = () => {
        if (table === "onsite_quote_requests") {
          return matches(state.onsite as unknown as Record<string, unknown>)
            ? state.onsite
            : null;
        }
        if (table === "conversations") {
          return matches(
            state.conversation as unknown as Record<string, unknown>,
          )
            ? state.conversation
            : null;
        }
        if (table === "requests") {
          return matches(state.request as unknown as Record<string, unknown>)
            ? state.request
            : null;
        }
        return null;
      };

      const applyUpdate = () => {
        const row = getSingleRow();
        if (!row || !updatePayload) return null;
        Object.assign(row, updatePayload);
        return row;
      };

      const builder = {
        select(_columns: string) {
          return builder;
        },
        update(payload: Record<string, unknown>) {
          mode = "update";
          updatePayload = payload;
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          mode = "insert";
          insertPayload = payload;
          if (table === "user_notifications" && insertPayload) {
            state.notifications.push(insertPayload);
          }
          return Promise.resolve({ error: null });
        },
        upsert(
          payload: Record<string, unknown>,
          _options: { onConflict: string },
        ) {
          mode = "upsert";
          upsertPayload = payload;
          if (table === "pro_calendar_events" && upsertPayload) {
            state.calendar.push(upsertPayload);
          }
          return Promise.resolve({ error: null });
        },
        eq(column: string, value: unknown) {
          filters.push({ op: "eq", column, value });
          return builder;
        },
        in(column: string, values: unknown[]) {
          inFilters.push({ column, values });
          return builder;
        },
        neq(column: string, value: unknown) {
          filters.push({ op: "neq", column, value });
          return builder;
        },
        maybeSingle() {
          if (mode === "update") {
            const row = applyUpdate();
            return Promise.resolve({
              data: row ? { id: String(row.id) } : null,
            });
          }
          return Promise.resolve({ data: getSingleRow() });
        },
        order() {
          return builder;
        },
        limit() {
          if (table === "messages") {
            return Promise.resolve({ data: [] });
          }
          return builder;
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          if (table === "profiles") {
            return Promise.resolve(
              resolve({
                data: state.profiles.filter((profile) =>
                  matches(profile as unknown as Record<string, unknown>),
                ),
                error: null,
              }),
            );
          }
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };

      return builder;
    },
  };
}

describe("finalizeOnsiteDepositPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_APP_URL = "https://handi.test";
    mocks.recordPayment
      .mockResolvedValueOnce({ ok: true, inserted: true, paymentId: "pay-1" })
      .mockResolvedValue({ ok: true, inserted: false, paymentId: "pay-1" });
    mocks.getProfessionalPayoutCommissionPercent.mockResolvedValue(5);
  });

  it("marks the onsite deposit as paid and emits side effects once", async () => {
    const state: FakeState = {
      onsite: {
        id: "onsite-1",
        conversation_id: "conv-1",
        request_id: "req-1",
        professional_id: "pro-profile-1",
        client_id: "client-profile-1",
        status: "deposit_pending",
        is_remunerable: true,
        deposit_amount: 200,
        deposit_payment_intent_id: null,
        deposit_paid_at: null,
        deposit_base_cents: null,
        deposit_fee_cents: null,
        deposit_iva_cents: null,
        deposit_total_cents: null,
        schedule_date: "2026-04-30",
        schedule_time_start: 9,
        schedule_time_end: 11,
      },
      conversation: {
        id: "conv-1",
        request_id: "req-1",
        customer_id: "client-user-1",
        pro_id: "pro-user-1",
      },
      request: {
        id: "req-1",
        title: "Instalacion de minisplit",
      },
      profiles: [
        { id: "pro-profile-1", full_name: "Servicios Handi" },
        { id: "client-profile-1", full_name: "Cliente Handi" },
      ],
      notifications: [],
      calendar: [],
    };
    const admin = createFakeAdmin(state);

    const first = await finalizeOnsiteDepositPayment({
      onsiteRequestId: "onsite-1",
      paymentIntentId: "pi_123",
      metadata: {
        type: "onsite_deposit",
        deposit_base_cents: "20000",
        deposit_fee_cents: "5000",
        deposit_iva_cents: "4000",
        deposit_total_cents: "29000",
      },
      amountTotalCents: 29000,
      source: "payment_intent.succeeded",
      admin: admin as never,
    });

    expect(first.ok).toBe(true);
    expect(first.updated).toBe(true);
    expect(first.alreadyPaid).toBe(false);
    expect(state.onsite.status).toBe("deposit_paid");
    expect(state.onsite.deposit_payment_intent_id).toBe("pi_123");
    expect(state.onsite.deposit_base_cents).toBe(20000);
    expect(state.notifications).toHaveLength(2);
    expect(state.calendar).toHaveLength(1);
    expect(state.calendar[0]?.event_kind).toBe("onsite_quote");
    expect(mocks.notifyChatMessageByConversation).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAdminsInApp).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/mensajes/conv-1");

    const duplicate = await finalizeOnsiteDepositPayment({
      onsiteRequestId: "onsite-1",
      paymentIntentId: "pi_123",
      metadata: {
        type: "onsite_deposit",
      },
      amountTotalCents: 29000,
      source: "checkout.session.completed",
      admin: admin as never,
    });

    expect(duplicate.ok).toBe(true);
    expect(duplicate.alreadyPaid).toBe(true);
    expect(duplicate.updated).toBe(false);
    expect(state.notifications).toHaveLength(2);
    expect(mocks.notifyChatMessageByConversation).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAdminsInApp).toHaveBeenCalledTimes(1);
  });
});
