import {
  getOnsiteQuoteRequestErrorDetails,
  getOnsiteQuoteRequestUserMessage,
} from "@/lib/chat/onsite-quote-errors";

describe("onsite quote errors", () => {
  it("maps active onsite duplicate to a friendly message", () => {
    const message = getOnsiteQuoteRequestUserMessage(
      {
        message: "ONSITE_ACTIVE_REQUEST_EXISTS",
        status: 409,
      },
      "chat.onsite-quote.create",
    );

    expect(message).toBe(
      "Ya existe una cotización en sitio activa en este chat.",
    );
  });

  it("maps eligible onsite credit duplicate to a friendly message", () => {
    const message = getOnsiteQuoteRequestUserMessage(
      {
        message: "ONSITE_ELIGIBLE_CREDIT_EXISTS",
        status: 409,
      },
      "chat.onsite-quote.create",
    );

    expect(message).toBe(
      "Ya existe una cotización en sitio remunerable pendiente de aplicarse para esta solicitud.",
    );
  });

  it("maps paid onsite duplicate to a friendly message", () => {
    const message = getOnsiteQuoteRequestUserMessage(
      {
        message: "ONSITE_PAID_REQUEST_EXISTS",
        status: 409,
      },
      "chat.onsite-quote.create",
    );

    expect(message).toBe(
      "Ya existe una cotización en sitio pagada en este chat. Continúa con la cotización final.",
    );
  });

  it("keeps detail and status for downstream logging", () => {
    const details = getOnsiteQuoteRequestErrorDetails({
      message: "ONSITE_QUOTE_REQUEST_INSERT_FAILED",
      detail: "insert or update on table violates foreign key constraint",
      status: 500,
    });

    expect(details).toEqual({
      code: "ONSITE_QUOTE_REQUEST_INSERT_FAILED",
      detail: "insert or update on table violates foreign key constraint",
      status: 500,
    });
  });
});
