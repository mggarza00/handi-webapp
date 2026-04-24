import { describe, expect, it } from "vitest";

import {
  buildManualPayoutCandidates,
  computeProfessionalPayoutBreakdown,
} from "@/lib/payouts/manual";

describe("manual payouts helpers", () => {
  it("computes the professional payout with the configured commission", () => {
    expect(computeProfessionalPayoutBreakdown(1000, 5)).toEqual({
      grossAmount: 1000,
      commissionAmount: 50,
      commissionPercent: 5,
      netAmount: 950,
    });
  });

  it("builds manual payout candidates without duplicating paid payouts", () => {
    const items = buildManualPayoutCandidates({
      commissionPercent: 5,
      payouts: [
        {
          id: "po-pending-old",
          agreement_id: "agr-2",
          request_id: "req-2",
          professional_id: "pro-2",
          amount: 200,
          currency: "MXN",
          status: "pending",
          paid_at: null,
          receipt_url: null,
          metadata: null,
          created_at: "2026-04-20T10:00:00.000Z",
        },
        {
          id: "po-paid",
          agreement_id: "agr-3",
          request_id: "req-3",
          professional_id: "pro-3",
          amount: 380,
          currency: "MXN",
          status: "paid",
          paid_at: "2026-04-19T10:00:00.000Z",
          receipt_url: "https://example.com/paid.png",
          metadata: {
            amount_basis: "net",
            gross_amount: 400,
            commission_pro_percent: 5,
            commission_pro_amount: 20,
          },
          created_at: "2026-04-19T09:00:00.000Z",
        },
      ],
      receipts: [
        {
          request_id: "req-1",
          professional_id: "pro-1",
          service_amount_cents: 10000,
          created_at: "2026-04-21T10:00:00.000Z",
        },
        {
          request_id: "req-4",
          professional_id: "pro-4",
          service_amount_cents: 5000,
          created_at: "2026-04-18T10:00:00.000Z",
        },
      ],
      agreements: [
        {
          id: "agr-1",
          request_id: "req-1",
          professional_id: "pro-1",
          amount: 100,
          status: "completed",
          updated_at: "2026-04-21T10:00:00.000Z",
          created_at: "2026-04-21T09:00:00.000Z",
        },
        {
          id: "agr-2",
          request_id: "req-2",
          professional_id: "pro-2",
          amount: 200,
          status: "completed",
          updated_at: "2026-04-20T10:00:00.000Z",
          created_at: "2026-04-20T09:00:00.000Z",
        },
        {
          id: "agr-4",
          request_id: "req-4",
          professional_id: "pro-4",
          amount: 50,
          status: "paid",
          updated_at: "2026-04-18T10:00:00.000Z",
          created_at: "2026-04-18T09:00:00.000Z",
        },
      ],
      requests: [
        { id: "req-1", title: "Reparación de boiler", status: "finished" },
        { id: "req-2", title: "Instalación eléctrica", status: "completed" },
        { id: "req-3", title: "Servicio pagado", status: "finished" },
        { id: "req-4", title: "Pintura", status: "in_process" },
      ],
      professionals: [
        { id: "pro-1", full_name: "Ana", email: "ana@example.com" },
        { id: "pro-2", full_name: "Luis", email: "luis@example.com" },
        { id: "pro-3", full_name: "Sara", email: "sara@example.com" },
        { id: "pro-4", full_name: "Paco", email: "paco@example.com" },
      ],
    });

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.requestId)).toEqual([
      "req-1",
      "req-2",
      "req-4",
    ]);

    expect(items[0]).toMatchObject({
      requestId: "req-1",
      professionalId: "pro-1",
      amount: 95,
      canCreate: true,
      source: "inferred",
    });

    expect(items[1]).toMatchObject({
      payoutId: "po-pending-old",
      requestId: "req-2",
      professionalId: "pro-2",
      amount: 190,
      canCreate: true,
      source: "existing_pending",
    });

    expect(items[2]).toMatchObject({
      requestId: "req-4",
      professionalId: "pro-4",
      amount: 47.5,
      canCreate: false,
      blockReason: "El servicio todavía no está finalizado.",
    });
  });
});
