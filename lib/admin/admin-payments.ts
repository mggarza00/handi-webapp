import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type JsonRecord = Record<string, unknown>;

type PaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "failed"
  | "canceled"
  | "disputed";

export type AdminPaymentListItem = {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  customer: string;
  created_at: string;
  payment_kind: "offer_payment" | "onsite_quote";
  type_label: string;
  remuneration_label: "Remunerable" | "No remunerable" | null;
  request_id: string | null;
  request_title: string | null;
  related_group_key: string;
  relation_label: string | null;
  onsite_credit_amount: number | null;
};

type PaymentRow = {
  id: string;
  request_id: string | null;
  amount: number | null;
  fee: number | null;
  vat: number | null;
  currency: string | null;
  status: string | null;
  payment_intent_id: string | null;
  created_at: string | null;
  metadata: JsonRecord | null;
};

type RequestRow = {
  id: string;
  title: string | null;
  created_by: string | null;
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

type ListAdminPaymentsArgs = {
  admin: SupabaseClient<Database>;
  from?: string | null;
  to?: string | null;
  status?: string | null;
  limit?: number;
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

const formatMoneyMx = (amount: number, currency = "MXN"): string => {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency}`;
  }
};

const paymentKindOrder = (
  kind: AdminPaymentListItem["payment_kind"],
): number => (kind === "onsite_quote" ? 0 : 1);

export async function listAdminPayments({
  admin,
  from,
  to,
  status,
  limit = 50,
}: ListAdminPaymentsArgs): Promise<AdminPaymentListItem[]> {
  let query = admin
    .from("payments")
    .select(
      "id, request_id, amount, fee, vat, currency, status, payment_intent_id, created_at, metadata",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("created_at", new Date(from).toISOString());
  if (to) query = query.lte("created_at", new Date(to).toISOString());
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "PAYMENTS_QUERY_FAILED");

  const payments = Array.isArray(data) ? (data as unknown as PaymentRow[]) : [];
  const requestIds = Array.from(
    new Set(
      payments
        .map((row) => asString(row.request_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const onsiteIds = Array.from(
    new Set(
      payments
        .map((row) => {
          const metadata = asRecord(row.metadata);
          return (
            asString(metadata?.onsite_request_id) ??
            asString(metadata?.onsite_quote_request_id)
          );
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const requestMap = new Map<string, RequestRow>();
  const customerNameMap = new Map<string, string>();
  if (requestIds.length > 0) {
    const { data: requestRows } = await admin
      .from("requests")
      .select("id, title, created_by")
      .in("id", requestIds);
    const requests = Array.isArray(requestRows)
      ? (requestRows as unknown as RequestRow[])
      : [];
    for (const row of requests) {
      requestMap.set(row.id, row);
    }
    const customerIds = Array.from(
      new Set(
        requests
          .map((row) => asString(row.created_by))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (customerIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", customerIds);
      for (const profile of (profiles ?? []) as ProfileRow[]) {
        customerNameMap.set(profile.id, profile.full_name || "Cliente");
      }
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

  const items = payments.map((row) => {
    const metadata = asRecord(row.metadata);
    const onsiteRequestId =
      asString(metadata?.onsite_request_id) ??
      asString(metadata?.onsite_quote_request_id);
    const onsite = onsiteRequestId
      ? (onsiteById.get(onsiteRequestId) ?? null)
      : null;
    const paymentKind =
      asString(metadata?.payment_type) === "onsite_quote" ||
      asString(metadata?.type) === "onsite_deposit"
        ? "onsite_quote"
        : "offer_payment";
    const remuneration =
      paymentKind === "onsite_quote"
        ? metadata?.is_remunerable === true || onsite?.is_remunerable === true
          ? "Remunerable"
          : "No remunerable"
        : null;
    const onsiteCreditAmountCents =
      paymentKind === "offer_payment"
        ? asNumber(metadata?.onsite_credit_base_cents)
        : null;
    const requestId = asString(row.request_id);
    const request = requestId ? (requestMap.get(requestId) ?? null) : null;
    const customerName =
      request?.created_by && customerNameMap.has(request.created_by)
        ? customerNameMap.get(request.created_by) || "Cliente"
        : "—";
    const groupKey =
      requestId ||
      asString(metadata?.conversation_id) ||
      asString(metadata?.conversationId) ||
      row.id;
    return {
      id: asString(row.payment_intent_id) || row.id,
      amount: Number(row.amount ?? 0),
      currency: asString(row.currency) || "MXN",
      status: (asString(row.status) as PaymentStatus) || "paid",
      customer: customerName,
      created_at: asString(row.created_at) || new Date(0).toISOString(),
      payment_kind: paymentKind,
      type_label:
        paymentKind === "onsite_quote"
          ? "Cotización en sitio"
          : "Oferta de contratación",
      remuneration_label: remuneration,
      request_id: requestId,
      request_title: request?.title || null,
      related_group_key: groupKey,
      relation_label: null,
      onsite_credit_amount:
        onsiteCreditAmountCents != null ? onsiteCreditAmountCents / 100 : null,
    } satisfies AdminPaymentListItem;
  });

  const groupMap = new Map<string, AdminPaymentListItem[]>();
  for (const item of items) {
    const group = groupMap.get(item.related_group_key) ?? [];
    group.push(item);
    groupMap.set(item.related_group_key, group);
  }

  for (const group of groupMap.values()) {
    const hasOnsite = group.some(
      (item) => item.payment_kind === "onsite_quote",
    );
    const hasOffer = group.some(
      (item) => item.payment_kind === "offer_payment",
    );
    for (const item of group) {
      if (item.payment_kind === "onsite_quote" && hasOffer) {
        item.relation_label = "Relacionado con contratación";
      } else if (
        item.payment_kind === "offer_payment" &&
        item.onsite_credit_amount
      ) {
        item.relation_label = `Descuento onsite aplicado ${formatMoneyMx(item.onsite_credit_amount, item.currency)}`;
      } else if (item.payment_kind === "offer_payment" && hasOnsite) {
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
    const leftGroup = left.related_group_key === right.related_group_key;
    if (leftGroup) {
      const kindDiff =
        paymentKindOrder(left.payment_kind) -
        paymentKindOrder(right.payment_kind);
      if (kindDiff !== 0) return kindDiff;
      return Date.parse(left.created_at) - Date.parse(right.created_at);
    }
    return Date.parse(right.created_at) - Date.parse(left.created_at);
  });
}
