import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type JsonRecord = Record<string, unknown>;

export type AdminPayoutListItem = {
  id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "canceled";
  created_at: string;
  paid_at: string | null;
  receipt_url: string | null;
  payout_kind: "service_offer" | "onsite_quote";
  type_label: string;
  remuneration_label: "Remunerable" | "No remunerable" | null;
  request_id: string | null;
  request_title: string | null;
  related_group_key: string;
  relation_label: string | null;
  gross_amount: number | null;
  commission_amount: number | null;
};

type PayoutRow = {
  id: string;
  professional_id: string | null;
  request_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string | null;
  paid_at: string | null;
  receipt_url: string | null;
  metadata: JsonRecord | null;
  payout_type: string | null;
};

type RequestRow = {
  id: string;
  title: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type OnsiteRow = {
  id: string;
  request_id: string | null;
  is_remunerable: boolean | null;
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

const payoutKindOrder = (kind: AdminPayoutListItem["payout_kind"]): number =>
  kind === "onsite_quote" ? 0 : 1;

export async function listAdminPayouts(
  admin: SupabaseClient<Database>,
): Promise<AdminPayoutListItem[]> {
  const { data, error } = await admin
    .from("payouts")
    .select(
      "id, request_id, professional_id, amount, currency, status, created_at, paid_at, receipt_url, metadata, payout_type",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "PAYOUTS_QUERY_FAILED");

  const payouts = Array.isArray(data) ? (data as unknown as PayoutRow[]) : [];
  const requestIds = Array.from(
    new Set(
      payouts
        .map((row) => asString(row.request_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const professionalIds = Array.from(
    new Set(
      payouts
        .map((row) => asString(row.professional_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const onsiteIds = Array.from(
    new Set(
      payouts
        .map((row) => asString(asRecord(row.metadata)?.onsite_request_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const requestMap = new Map<string, RequestRow>();
  if (requestIds.length > 0) {
    const { data: requestRows } = await admin
      .from("requests")
      .select("id, title")
      .in("id", requestIds);
    for (const row of (requestRows ?? []) as RequestRow[]) {
      requestMap.set(row.id, row);
    }
  }

  const professionalNameMap = new Map<string, string>();
  if (professionalIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", professionalIds);
    for (const row of (profiles ?? []) as ProfileRow[]) {
      professionalNameMap.set(row.id, row.full_name || row.id);
    }
  }

  const onsiteById = new Map<string, OnsiteRow>();
  if (onsiteIds.length > 0) {
    const { data: onsiteRows } = await admin
      .from("onsite_quote_requests")
      .select("id, request_id, is_remunerable")
      .in("id", onsiteIds);
    for (const row of (onsiteRows ?? []) as OnsiteRow[]) {
      onsiteById.set(row.id, row);
    }
  }

  const items = payouts.map((row) => {
    const metadata = asRecord(row.metadata);
    const onsiteRequestId = asString(metadata?.onsite_request_id);
    const onsite = onsiteRequestId
      ? (onsiteById.get(onsiteRequestId) ?? null)
      : null;
    const payoutKind =
      asString(row.payout_type) === "onsite_quote" ||
      asString(metadata?.payout_type) === "onsite_quote"
        ? "onsite_quote"
        : "service_offer";
    const remuneration =
      payoutKind === "onsite_quote"
        ? metadata?.is_remunerable === true || onsite?.is_remunerable === true
          ? "Remunerable"
          : "No remunerable"
        : null;
    const requestId = asString(row.request_id);
    const requestTitle = requestId
      ? requestMap.get(requestId)?.title || null
      : null;
    const groupKey =
      requestId ||
      asString(metadata?.conversation_id) ||
      onsiteRequestId ||
      row.id;
    return {
      id: row.id,
      professional_id: asString(row.professional_id) || "",
      professional_name:
        professionalNameMap.get(asString(row.professional_id) || "") ||
        asString(row.professional_id) ||
        "—",
      amount: Number(row.amount ?? 0),
      currency: asString(row.currency) || "MXN",
      status:
        (asString(row.status) as AdminPayoutListItem["status"]) || "pending",
      created_at: asString(row.created_at) || new Date(0).toISOString(),
      paid_at: asString(row.paid_at),
      receipt_url: asString(row.receipt_url),
      payout_kind: payoutKind,
      type_label:
        payoutKind === "onsite_quote"
          ? "Cotización en sitio"
          : "Oferta de contratación",
      remuneration_label: remuneration,
      request_id: requestId,
      request_title: requestTitle,
      related_group_key: groupKey,
      relation_label: null,
      gross_amount: asNumber(metadata?.gross_amount),
      commission_amount: asNumber(metadata?.commission_pro_amount),
    } satisfies AdminPayoutListItem;
  });

  const groupMap = new Map<string, AdminPayoutListItem[]>();
  for (const item of items) {
    const group = groupMap.get(item.related_group_key) ?? [];
    group.push(item);
    groupMap.set(item.related_group_key, group);
  }

  for (const group of groupMap.values()) {
    const hasOnsite = group.some((item) => item.payout_kind === "onsite_quote");
    const hasOffer = group.some((item) => item.payout_kind === "service_offer");
    for (const item of group) {
      if (item.payout_kind === "onsite_quote" && hasOffer) {
        item.relation_label = "Relacionado con payout final";
      } else if (item.payout_kind === "service_offer" && hasOnsite) {
        item.relation_label = "Relacionado con cotización onsite";
      }
    }
  }

  const groupLatest = new Map<string, number>();
  for (const item of items) {
    const current = groupLatest.get(item.related_group_key) ?? 0;
    const created = Date.parse(item.created_at);
    if (created > current) groupLatest.set(item.related_group_key, created);
  }

  return items.sort((left, right) => {
    const groupDiff =
      (groupLatest.get(right.related_group_key) ?? 0) -
      (groupLatest.get(left.related_group_key) ?? 0);
    if (groupDiff !== 0) return groupDiff;
    if (left.related_group_key === right.related_group_key) {
      const kindDiff =
        payoutKindOrder(left.payout_kind) - payoutKindOrder(right.payout_kind);
      if (kindDiff !== 0) return kindDiff;
      return Date.parse(left.created_at) - Date.parse(right.created_at);
    }
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}
