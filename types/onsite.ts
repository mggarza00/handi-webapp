export const ONSITE_REQUEST_STATUSES = [
  "requested",
  "scheduled",
  "accepted",
  "rejected",
  "deposit_pending",
  "deposit_paid",
  "no_show",
  "completed",
  "canceled",
] as const;

export type OnsiteRequestStatus = (typeof ONSITE_REQUEST_STATUSES)[number];

export const ONSITE_STATUS_TRANSITIONS: Record<
  OnsiteRequestStatus,
  OnsiteRequestStatus[]
> = {
  requested: ["scheduled", "deposit_pending", "rejected", "canceled"],
  scheduled: ["deposit_pending", "accepted", "rejected", "no_show", "canceled"],
  accepted: ["deposit_pending", "completed", "canceled"],
  rejected: [],
  deposit_pending: ["deposit_paid", "canceled"],
  deposit_paid: ["completed", "no_show", "canceled"],
  no_show: ["scheduled", "canceled"],
  completed: [],
  canceled: [],
};

export type OnsiteMessagePayload = {
  onsite_request_id: string;
  status: OnsiteRequestStatus;
  deposit_amount?: number | null;
  details?: string | null;
  is_remunerable?: boolean | null;
  checkout_url?: string | null;
  remuneration_applied_offer_id?: string | null;
  remuneration_applied_at?: string | null;
};
