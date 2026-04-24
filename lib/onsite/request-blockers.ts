export type OnsiteBlockingRow = {
  id?: string | null;
  conversation_id?: string | null;
  request_id?: string | null;
  status?: string | null;
  is_remunerable?: boolean | null;
  remuneration_applied_at?: string | null;
  deposit_paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OnsiteBlockerCode =
  | "ONSITE_ACTIVE_REQUEST_EXISTS"
  | "ONSITE_ELIGIBLE_CREDIT_EXISTS";

export type OnsiteBlockerResult = {
  code: OnsiteBlockerCode;
  blocker: Required<
    Pick<
      OnsiteBlockingRow,
      | "id"
      | "conversation_id"
      | "request_id"
      | "status"
      | "is_remunerable"
      | "remuneration_applied_at"
      | "deposit_paid_at"
      | "created_at"
      | "updated_at"
    >
  >;
} | null;

function normalizeStatus(value?: string | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toNullableString(value?: string | null): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

function normalizeBlockerRow(
  row: OnsiteBlockingRow,
): NonNullable<OnsiteBlockerResult>["blocker"] {
  return {
    id: toNullableString(row.id),
    conversation_id: toNullableString(row.conversation_id),
    request_id: toNullableString(row.request_id),
    status: normalizeStatus(row.status),
    is_remunerable: row.is_remunerable === true,
    remuneration_applied_at: toNullableString(row.remuneration_applied_at),
    deposit_paid_at: toNullableString(row.deposit_paid_at),
    created_at: toNullableString(row.created_at),
    updated_at: toNullableString(row.updated_at),
  };
}

export function findOnsiteRequestBlocker(
  rows: OnsiteBlockingRow[] | null | undefined,
): OnsiteBlockerResult {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const activeRow = normalizedRows.find((row) =>
    ["requested", "scheduled", "accepted", "deposit_pending"].includes(
      normalizeStatus(row.status),
    ),
  );
  if (activeRow) {
    return {
      code: "ONSITE_ACTIVE_REQUEST_EXISTS",
      blocker: normalizeBlockerRow(activeRow),
    };
  }

  const eligibleCreditRow = normalizedRows.find(
    (row) =>
      normalizeStatus(row.status) === "deposit_paid" &&
      row.is_remunerable === true &&
      !toNullableString(row.remuneration_applied_at),
  );
  if (eligibleCreditRow) {
    return {
      code: "ONSITE_ELIGIBLE_CREDIT_EXISTS",
      blocker: normalizeBlockerRow(eligibleCreditRow),
    };
  }

  return null;
}
