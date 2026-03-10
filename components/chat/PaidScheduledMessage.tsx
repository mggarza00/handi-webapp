import * as React from "react";

type ViewerRole = "customer" | "professional" | "guest" | "client" | "pro";

type PaidScheduledPayload = {
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  address_line?: string | null;
  city?: string | null;
  receipt_id?: string | null;
  receipt_url?: string | null;
  receipt_view_url?: string | null;
  receipt_download_url?: string | null;
  view_url?: string | null;
  download_url?: string | null;
};

type PaidScheduledMessageProps = {
  payload: PaidScheduledPayload;
  viewerRole: ViewerRole;
  onOpenNextSteps: () => void;
};

const toTrimmed = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

function formatScheduledDate(raw: string | null): string | null {
  if (!raw) return null;
  const dateOnly = raw.includes("T") ? raw.slice(0, 10) : raw;
  const normalized = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(normalized.getTime())) return toTrimmed(raw);
  return normalized.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildReceiptLink(payload: PaidScheduledPayload): string | null {
  const receiptId = toTrimmed(payload.receipt_id);
  return (
    toTrimmed(payload.receipt_view_url) ||
    toTrimmed(payload.view_url) ||
    toTrimmed(payload.receipt_download_url) ||
    toTrimmed(payload.download_url) ||
    (receiptId ? `/api/receipts/${encodeURIComponent(receiptId)}/pdf` : null) ||
    toTrimmed(payload.receipt_url)
  );
}

export default function PaidScheduledMessage({
  payload,
  viewerRole,
  onOpenNextSteps,
}: PaidScheduledMessageProps) {
  const isProfessional = viewerRole === "professional" || viewerRole === "pro";
  const isCustomer = viewerRole === "customer" || viewerRole === "client";

  const scheduledDate = formatScheduledDate(toTrimmed(payload.scheduled_date));
  const scheduledTime = toTrimmed(payload.scheduled_time);
  const addressLine = toTrimmed(payload.address_line);
  const city = toTrimmed(payload.city);
  const addressText =
    [addressLine, city]
      .filter((part): part is string => Boolean(part))
      .join(", ") || null;

  const dateLabel = scheduledDate || "por confirmar";
  const addressLabel = addressText || "direccion por confirmar";
  const timeLabel = scheduledTime || "por confirmar";
  const receiptLink = buildReceiptLink(payload);
  const intro = isProfessional
    ? "El cliente ha realizado el pago."
    : "Pago realizado.";

  return (
    <div className="space-y-1.5">
      <div className="text-sm text-slate-800 leading-relaxed">
        <span className="font-semibold text-emerald-700">{intro}</span>{" "}
        <span>El servicio ha sido agendado para el dia </span>
        <span className="text-blue-700">{dateLabel}</span>
        <span> en </span>
        <span className="text-blue-700">{addressLabel}</span>
        <span>. Horario: </span>
        <span className="text-blue-700">{timeLabel}</span>
        <span>.</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={onOpenNextSteps}
          className="text-orange-600 underline underline-offset-2 hover:text-orange-700"
        >
          Que sigue?
        </button>
        {isCustomer && receiptLink ? (
          <a
            href={receiptLink}
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-700 hover:text-blue-800"
          >
            Comprobante de pago Ver recibo
          </a>
        ) : null}
      </div>
    </div>
  );
}
