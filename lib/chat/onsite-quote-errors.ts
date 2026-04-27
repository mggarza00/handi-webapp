import { normalizeAppError } from "@/lib/errors/app-error";

type OnsiteQuoteRequestErrorDetails = {
  code: string | null;
  detail: string | null;
  status?: number;
};

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function getOnsiteQuoteRequestErrorDetails(
  error: unknown,
): OnsiteQuoteRequestErrorDetails {
  if (!error || typeof error !== "object") {
    return { code: toText(error), detail: null };
  }
  const record = error as Record<string, unknown>;
  return {
    code: toText(record.message) || toText(record.error),
    detail: toText(record.detail),
    status: toStatus(record.status),
  };
}

export function getOnsiteQuoteRequestUserMessage(
  error: unknown,
  source: string,
): string {
  const details = getOnsiteQuoteRequestErrorDetails(error);
  switch (details.code) {
    case "ONSITE_QUOTE_REQUEST_VALIDATION_FAILED":
      return "Revisa los datos de la cotización en sitio e inténtalo de nuevo.";
    case "ONSITE_ACTIVE_REQUEST_EXISTS":
      return "Ya existe una cotización en sitio activa en este chat.";
    case "ONSITE_ELIGIBLE_CREDIT_EXISTS":
      return "Ya existe una cotización en sitio remunerable pendiente de aplicarse para esta solicitud.";
    case "ONSITE_PAID_REQUEST_EXISTS":
      return "Ya existe una cotización en sitio pagada en este chat. Continúa con la cotización final.";
    case "ONLY_PRO_CAN_REQUEST_ONSITE":
      return "Solo el profesional puede solicitar una cotización en sitio.";
    case "INVALID_SCHEDULE_RANGE":
      return "Selecciona un horario válido para la visita.";
    case "UNSUPPORTED_MEDIA_TYPE":
      return "No se pudo enviar la cotización en sitio. Inténtalo de nuevo.";
    default:
      return normalizeAppError(error, {
        source,
        status: details.status,
        code: details.code,
        detail: details.detail,
      }).userMessage;
  }
}
