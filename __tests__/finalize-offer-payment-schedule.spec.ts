import { describe, expect, it } from "vitest";

import { __finalizeOfferPaymentInternals } from "@/lib/payments/finalize-offer-payment";

const {
  resolveOfferScheduleDisplay,
  formatHourRangeEsMx,
  formatSingleTimeEsMx,
} = __finalizeOfferPaymentInternals;

describe("finalizeOfferPayment schedule resolution", () => {
  it("uses Horario flexible from offer metadata", () => {
    const result = resolveOfferScheduleDisplay({
      agreementScheduledTime: null,
      offerMetadata: { flexible_schedule: true },
      offerDescription: null,
      requestScheduledTime: null,
      parsedService: {
        date: "2026-03-12",
        time: "06:00",
        displayTime: "06:00",
      },
      rawServiceDate: "2026-03-12T06:00:00.000Z",
    });
    expect(result.displayTime).toBe("Horario flexible");
    expect(result.dbTime).toBeNull();
  });

  it("uses metadata hour range as display and db start time", () => {
    const result = resolveOfferScheduleDisplay({
      agreementScheduledTime: null,
      offerMetadata: { schedule: { start_hour: 9, end_hour: 14 } },
      offerDescription: null,
      requestScheduledTime: null,
      parsedService: {
        date: "2026-03-12",
        time: "06:00",
        displayTime: "06:00",
      },
      rawServiceDate: "2026-03-12T06:00:00.000Z",
    });
    expect(result.displayTime).toBe(formatHourRangeEsMx(9, 14));
    expect(result.dbTime).toBe("09:00");
  });

  it("keeps explicit puntual agreement time and never falls back to 06:00", () => {
    const result = resolveOfferScheduleDisplay({
      agreementScheduledTime: "16:30",
      offerMetadata: {},
      offerDescription: null,
      requestScheduledTime: "06:00",
      parsedService: {
        date: "2026-03-12",
        time: "06:00",
        displayTime: "06:00",
      },
      rawServiceDate: "2026-03-12T06:00:00.000Z",
    });
    expect(result.displayTime).toBe(formatSingleTimeEsMx("16:30"));
    expect(result.dbTime).toBe("16:30");
  });

  it("does not invent 06:00 when only date-derived service_date exists", () => {
    const result = resolveOfferScheduleDisplay({
      agreementScheduledTime: null,
      offerMetadata: {},
      offerDescription: null,
      requestScheduledTime: null,
      parsedService: {
        date: "2026-03-12",
        time: "06:00",
        displayTime: "06:00",
      },
      rawServiceDate: "2026-03-12T06:00:00.000Z",
    });
    expect(result.displayTime).toBeNull();
    expect(result.dbTime).toBeNull();
  });
});
