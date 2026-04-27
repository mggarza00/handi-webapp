import { revalidatePath, revalidateTag } from "next/cache";

import { notifyAdminsEmail, notifyAdminsInApp } from "@/lib/admin/admin-notify";
import { notifyChatMessageByConversation } from "@/lib/chat-notifier";
import { computeClientTotalsCents } from "@/lib/payments/fees";
import { recordPayment } from "@/lib/payments/record-payment";
import {
  computeProfessionalPayoutBreakdown,
  getProfessionalPayoutCommissionPercent,
} from "@/lib/payouts/manual";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

type AdminClient = ReturnType<typeof getAdminSupabase>;

type FinalizeOnsiteDepositPaymentArgs = {
  onsiteRequestId: string;
  paymentIntentId?: string | null;
  metadata?: Record<string, unknown> | null;
  amountTotalCents?: number | null;
  source:
    | "checkout.session.completed"
    | "payment_intent.succeeded"
    | "sync"
    | string;
  admin?: AdminClient;
};

type FinalizeOnsiteDepositPaymentResult = {
  ok: boolean;
  alreadyPaid: boolean;
  updated: boolean;
  onsiteRequestId: string;
  conversationId: string | null;
  requestId: string | null;
  professionalUserId: string | null;
  clientUserId: string | null;
  messageEnsured: boolean;
  professionalNotificationCreated: boolean;
  clientNotificationCreated: boolean;
  calendarUpserted: boolean;
};

type OnsiteRow = {
  id: string;
  conversation_id: string | null;
  request_id: string | null;
  professional_id: string | null;
  client_id: string | null;
  status: string | null;
  is_remunerable: boolean | null;
  deposit_amount: number | null;
  deposit_checkout_url: string | null;
  deposit_payment_intent_id: string | null;
  deposit_paid_at: string | null;
  deposit_base_cents: number | null;
  deposit_fee_cents: number | null;
  deposit_iva_cents: number | null;
  deposit_total_cents: number | null;
  schedule_date: string | null;
  schedule_time_start: number | null;
  schedule_time_end: number | null;
  details: string | null;
  notes: string | null;
};

type ConversationRow = {
  id: string;
  request_id: string | null;
  customer_id: string | null;
  pro_id: string | null;
};

type RequestRow = {
  id: string;
  title: string | null;
};

type ProfileSummaryRow = {
  id: string;
  full_name: string | null;
};

type MessagesRow = {
  id: string;
  payload: Record<string, unknown> | null;
};

const DEBUG_ONSITE_PAYMENT = process.env.DEBUG_ONSITE_PAYMENT === "1";

function logOnsiteDiagnostic(
  stage: string,
  data: Record<string, unknown>,
): void {
  if (!DEBUG_ONSITE_PAYMENT) return;
  try {
    console.info(
      `[onsite-payment] ${JSON.stringify({
        stage,
        ...data,
      })}`,
    );
  } catch {
    console.info("[onsite-payment]", stage);
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!error) return {};
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: DEBUG_ONSITE_PAYMENT ? error.stack : undefined,
    };
  }
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    return {
      code: obj.code ?? null,
      message: obj.message ?? null,
      details: obj.details ?? null,
      hint: obj.hint ?? null,
      status: obj.status ?? null,
    };
  }
  return { message: String(error) };
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatScheduleTime(startHour: number | null): string | null {
  if (!Number.isFinite(startHour)) return null;
  const normalized = Math.max(0, Math.min(23, Math.floor(startHour as number)));
  return `${String(normalized).padStart(2, "0")}:00`;
}

function formatMoneyMx(amount: number, currency = "MXN"): string {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency}`;
  }
}

function isOnsiteDepositMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const type = toTrimmedString(metadata?.type);
  return type === "onsite_deposit";
}

function resolveDepositBreakdownCents(args: {
  metadata: Record<string, unknown> | null | undefined;
  onsite: OnsiteRow;
  amountTotalCents: number | null;
}) {
  const metadata = args.metadata ?? {};
  const baseCents =
    toFiniteNumber(metadata.deposit_base_cents) ??
    toFiniteNumber(metadata.base_cents) ??
    args.onsite.deposit_base_cents ??
    null;
  const feeCents =
    toFiniteNumber(metadata.deposit_fee_cents) ??
    toFiniteNumber(metadata.commission_cents) ??
    args.onsite.deposit_fee_cents ??
    null;
  const ivaCents =
    toFiniteNumber(metadata.deposit_iva_cents) ??
    toFiniteNumber(metadata.iva_cents) ??
    args.onsite.deposit_iva_cents ??
    null;
  const totalCents =
    toFiniteNumber(metadata.deposit_total_cents) ??
    toFiniteNumber(metadata.total_cents) ??
    args.amountTotalCents ??
    args.onsite.deposit_total_cents ??
    null;

  if (
    baseCents != null &&
    feeCents != null &&
    ivaCents != null &&
    totalCents != null
  ) {
    return {
      baseCents: Math.round(baseCents),
      feeCents: Math.round(feeCents),
      ivaCents: Math.round(ivaCents),
      totalCents: Math.round(totalCents),
    };
  }

  const fallbackAmountMx = Number(args.onsite.deposit_amount ?? NaN);
  if (Number.isFinite(fallbackAmountMx) && fallbackAmountMx > 0) {
    const fallback = computeClientTotalsCents(fallbackAmountMx);
    return {
      baseCents: baseCents != null ? Math.round(baseCents) : fallback.baseCents,
      feeCents: feeCents != null ? Math.round(feeCents) : fallback.feeCents,
      ivaCents: ivaCents != null ? Math.round(ivaCents) : fallback.ivaCents,
      totalCents:
        totalCents != null ? Math.round(totalCents) : fallback.totalCents,
    };
  }

  return {
    baseCents: baseCents != null ? Math.round(baseCents) : null,
    feeCents: feeCents != null ? Math.round(feeCents) : null,
    ivaCents: ivaCents != null ? Math.round(ivaCents) : null,
    totalCents: totalCents != null ? Math.round(totalCents) : null,
  };
}

async function ensurePaidSystemMessage(args: {
  admin: AdminClient;
  conversationId: string | null;
  senderId: string | null;
  onsite: OnsiteRow;
}): Promise<boolean> {
  const { admin, conversationId, senderId, onsite } = args;
  if (!conversationId || !senderId) return false;

  const { data: existingMessages, error: existingError } = await admin
    .from("messages")
    .select("id, payload")
    .eq("conversation_id", conversationId)
    .eq("message_type", "system")
    .order("created_at", { ascending: false })
    .limit(50);

  if (existingError) {
    throw new Error(
      `ONSITE_PAID_MESSAGE_LOOKUP_FAILED:${existingError.message || "unknown"}`,
    );
  }

  const existing = (existingMessages ?? []) as MessagesRow[];
  const hasPaidMessage = existing.some((message) => {
    const payload =
      message.payload && typeof message.payload === "object"
        ? message.payload
        : null;
    if (!payload) return false;
    const currentOnsiteId =
      toTrimmedString(payload.onsite_request_id) ??
      toTrimmedString(payload.onsite_quote_request_id);
    const currentStatus =
      toTrimmedString(payload.status)?.toLowerCase() ?? null;
    return currentOnsiteId === onsite.id && currentStatus === "deposit_paid";
  });

  if (hasPaidMessage) return false;

  const payload = {
    onsite_request_id: onsite.id,
    onsite_quote_request_id: onsite.id,
    status: "deposit_paid",
    deposit_amount: onsite.deposit_amount,
    details: onsite.details ?? onsite.notes,
    notes: onsite.notes,
    is_remunerable: onsite.is_remunerable === true,
    schedule_date: onsite.schedule_date,
    schedule_time_start: onsite.schedule_time_start,
    schedule_time_end: onsite.schedule_time_end,
  };

  const { error: insertError } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: "Pago de cotizacion en sitio confirmado",
    message_type: "system",
    payload,
  });

  if (insertError) {
    throw new Error(
      `ONSITE_PAID_MESSAGE_INSERT_FAILED:${insertError.message || "unknown"}`,
    );
  }

  return true;
}

async function insertUserNotification(args: {
  admin: AdminClient;
  userId: string | null;
  type: string;
  title: string;
  body: string;
  link: string;
}): Promise<boolean> {
  const { admin, userId, type, title, body, link } = args;
  if (!userId) return false;
  const { error } = await (
    admin as unknown as {
      from: (table: string) => {
        insert: (
          payload: Record<string, unknown>,
        ) => Promise<{ error: { message?: string } | null }>;
      };
    }
  )
    .from("user_notifications")
    .insert({
      user_id: userId,
      type,
      title,
      body,
      link,
    });
  if (error) {
    throw new Error(
      `ONSITE_NOTIFICATION_INSERT_FAILED:${error.message || "unknown"}`,
    );
  }
  return true;
}

async function notifyPush(args: {
  userId: string | null;
  title: string;
  body: string;
  conversationId: string;
  onsiteRequestId: string;
}): Promise<boolean> {
  const { userId, title, body, conversationId, onsiteRequestId } = args;
  if (!userId) return false;
  const functionsBase =
    process.env.SUPABASE_FUNCTIONS_URL ||
    (process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/functions/v1`
      : null);
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!functionsBase || !serviceRole) return false;

  await fetch(`${functionsBase.replace(/\/$/, "")}/push-notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({
      toUserId: userId,
      payload: {
        title,
        body,
        url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ""}/mensajes/${encodeURIComponent(conversationId)}`,
        tag: `onsite-paid:${onsiteRequestId}:${userId}`,
        data: {
          type: "onsite_deposit_paid",
          onsite_request_id: onsiteRequestId,
          conversation_id: conversationId,
        },
      },
    }),
  });

  return true;
}

async function upsertProfessionalCalendar(args: {
  admin: AdminClient;
  professionalUserId: string | null;
  requestId: string | null;
  requestTitle: string | null;
  onsite: OnsiteRow;
}): Promise<boolean> {
  const { admin, professionalUserId, requestId, requestTitle, onsite } = args;
  if (
    !professionalUserId ||
    !requestId ||
    !onsite.schedule_date ||
    !Number.isFinite(onsite.schedule_time_start)
  ) {
    logOnsiteDiagnostic("calendar.todo", {
      onsiteRequestId: onsite.id,
      professionalUserId,
      requestId,
      scheduleDate: onsite.schedule_date,
      scheduleTimeStart: onsite.schedule_time_start,
      scheduleTimeEnd: onsite.schedule_time_end,
      reason: "missing_schedule_fields",
    });
    return false;
  }

  const scheduledTime = formatScheduleTime(onsite.schedule_time_start);
  const { error } = await (
    admin as unknown as {
      from: (table: string) => {
        upsert: (
          payload: Record<string, unknown>,
          options: { onConflict: string },
        ) => Promise<{ error: { message?: string } | null }>;
      };
    }
  )
    .from("pro_calendar_events")
    .upsert(
      {
        pro_id: professionalUserId,
        request_id: requestId,
        title: requestTitle
          ? `Visita de cotizacion en sitio - ${requestTitle}`
          : "Visita de cotizacion en sitio",
        scheduled_date: onsite.schedule_date,
        scheduled_time: scheduledTime,
        status: "scheduled",
        event_kind: "onsite_quote",
      },
      { onConflict: "request_id" },
    );

  if (error) {
    throw new Error(
      `ONSITE_CALENDAR_UPSERT_FAILED:${error.message || "unknown"}`,
    );
  }

  return true;
}

async function upsertOnsitePayout(args: {
  admin: AdminClient;
  onsite: OnsiteRow;
  requestId: string | null;
  professionalProfileId: string | null;
  paymentIntentId: string | null;
  conversationId: string | null;
  breakdown: {
    baseCents: number | null;
    feeCents: number | null;
    ivaCents: number | null;
    totalCents: number | null;
  };
}): Promise<boolean> {
  const {
    admin,
    onsite,
    requestId,
    professionalProfileId,
    paymentIntentId,
    conversationId,
    breakdown,
  } = args;
  if (!requestId || !professionalProfileId) {
    logOnsiteDiagnostic("payout.skip.missing_target", {
      onsiteRequestId: onsite.id,
      requestId,
      professionalProfileId,
    });
    return false;
  }
  const grossAmount = Number((breakdown.baseCents ?? 0) / 100);
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
    logOnsiteDiagnostic("payout.skip.invalid_amount", {
      onsiteRequestId: onsite.id,
      grossAmount,
      breakdown,
    });
    return false;
  }

  const commissionPercent = await getProfessionalPayoutCommissionPercent(admin);
  const payoutBreakdown = computeProfessionalPayoutBreakdown(
    grossAmount,
    commissionPercent,
  );
  const payoutMetadata = {
    source: "onsite_deposit",
    payout_type: "onsite_quote",
    onsite_request_id: onsite.id,
    conversation_id: conversationId,
    is_remunerable: onsite.is_remunerable === true,
    amount_basis: "net",
    gross_amount: payoutBreakdown.grossAmount,
    commission_pro_percent: payoutBreakdown.commissionPercent,
    commission_pro_amount: payoutBreakdown.commissionAmount,
    deposit_payment_intent_id: paymentIntentId,
    deposit_base_cents: breakdown.baseCents,
    deposit_fee_cents: breakdown.feeCents,
    deposit_iva_cents: breakdown.ivaCents,
    deposit_total_cents: breakdown.totalCents,
  };

  // Supabase generated types lag behind this migration-backed column.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminPayouts = admin as any;
  const payoutSelect = await adminPayouts
    .from("payouts")
    .select("id, status")
    .eq("request_id", requestId)
    .eq("professional_id", professionalProfileId)
    .eq("payout_type", "onsite_quote")
    .maybeSingle();

  if (payoutSelect.error) {
    throw new Error(
      `ONSITE_PAYOUT_LOOKUP_FAILED:${payoutSelect.error.message || "unknown"}`,
    );
  }

  if (payoutSelect.data?.id) {
    const { error } = await adminPayouts
      .from("payouts")
      .update({
        amount: payoutBreakdown.netAmount,
        currency: "MXN",
        metadata: payoutMetadata,
      })
      .eq("id", payoutSelect.data.id);
    if (error) {
      throw new Error(
        `ONSITE_PAYOUT_UPDATE_FAILED:${error.message || "unknown"}`,
      );
    }
    return false;
  }

  const { error } = await adminPayouts.from("payouts").insert({
    request_id: requestId,
    professional_id: professionalProfileId,
    amount: payoutBreakdown.netAmount,
    currency: "MXN",
    status: "pending",
    payout_type: "onsite_quote",
    metadata: payoutMetadata,
  });
  if (error) {
    throw new Error(
      `ONSITE_PAYOUT_INSERT_FAILED:${error.message || "unknown"}`,
    );
  }
  return true;
}

export async function finalizeOnsiteDepositPayment(
  args: FinalizeOnsiteDepositPaymentArgs,
): Promise<FinalizeOnsiteDepositPaymentResult> {
  const onsiteRequestId = args.onsiteRequestId.trim();
  if (!onsiteRequestId) {
    return {
      ok: false,
      alreadyPaid: false,
      updated: false,
      onsiteRequestId: "",
      conversationId: null,
      requestId: null,
      professionalUserId: null,
      clientUserId: null,
      messageEnsured: false,
      professionalNotificationCreated: false,
      clientNotificationCreated: false,
      calendarUpserted: false,
    };
  }

  logOnsiteDiagnostic("finalize.start", {
    onsiteRequestId,
    paymentIntentId: args.paymentIntentId ?? null,
    source: args.source,
    metadataType: toTrimmedString(args.metadata?.type),
    metadata: args.metadata ?? null,
    amountTotalCents: args.amountTotalCents ?? null,
  });

  if (args.metadata && !isOnsiteDepositMetadata(args.metadata)) {
    logOnsiteDiagnostic("finalize.skip.invalid_metadata", {
      onsiteRequestId,
      metadata: args.metadata,
    });
    return {
      ok: false,
      alreadyPaid: false,
      updated: false,
      onsiteRequestId,
      conversationId: null,
      requestId: null,
      professionalUserId: null,
      clientUserId: null,
      messageEnsured: false,
      professionalNotificationCreated: false,
      clientNotificationCreated: false,
      calendarUpserted: false,
    };
  }

  const admin = args.admin ?? getAdminSupabase();
  const nowIso = new Date().toISOString();

  const onsiteSelect = await admin
    .from("onsite_quote_requests")
    .select(
      "id, conversation_id, request_id, professional_id, client_id, status, is_remunerable, deposit_amount, deposit_checkout_url, deposit_payment_intent_id, deposit_paid_at, deposit_base_cents, deposit_fee_cents, deposit_iva_cents, deposit_total_cents, schedule_date, schedule_time_start, schedule_time_end, details, notes",
    )
    .eq("id", onsiteRequestId)
    .maybeSingle();

  if (onsiteSelect.error) {
    logOnsiteDiagnostic("finalize.onsite_lookup.error", {
      onsiteRequestId,
      error: serializeError(onsiteSelect.error),
    });
    throw new Error(
      `ONSITE_LOOKUP_FAILED:${onsiteSelect.error.message || "unknown"}`,
    );
  }

  const onsite = (onsiteSelect.data ?? null) as OnsiteRow | null;
  if (!onsite?.id) {
    logOnsiteDiagnostic("finalize.onsite_lookup.missing", {
      onsiteRequestId,
    });
    return {
      ok: false,
      alreadyPaid: false,
      updated: false,
      onsiteRequestId,
      conversationId: null,
      requestId: null,
      professionalUserId: null,
      clientUserId: null,
      messageEnsured: false,
      professionalNotificationCreated: false,
      clientNotificationCreated: false,
      calendarUpserted: false,
    };
  }

  const conversationSelect = onsite.conversation_id
    ? await admin
        .from("conversations")
        .select("id, request_id, customer_id, pro_id")
        .eq("id", onsite.conversation_id)
        .maybeSingle()
    : { data: null, error: null };
  if (conversationSelect.error) {
    logOnsiteDiagnostic("finalize.conversation_lookup.error", {
      onsiteRequestId,
      conversationId: onsite.conversation_id ?? null,
      error: serializeError(conversationSelect.error),
    });
    throw new Error(
      `ONSITE_CONVERSATION_LOOKUP_FAILED:${conversationSelect.error.message || "unknown"}`,
    );
  }
  const conversation = (conversationSelect.data ??
    null) as ConversationRow | null;
  const requestId = onsite.request_id ?? conversation?.request_id ?? null;
  const conversationId = onsite.conversation_id ?? conversation?.id ?? null;
  const professionalUserId =
    conversation?.pro_id ?? onsite.professional_id ?? null;
  const clientUserId = conversation?.customer_id ?? onsite.client_id ?? null;

  const requestSelect = requestId
    ? await admin
        .from("requests")
        .select("id, title")
        .eq("id", requestId)
        .maybeSingle()
    : { data: null, error: null };
  if (requestSelect.error) {
    logOnsiteDiagnostic("finalize.request_lookup.error", {
      onsiteRequestId,
      requestId,
      error: serializeError(requestSelect.error),
    });
    throw new Error(
      `ONSITE_REQUEST_LOOKUP_FAILED:${requestSelect.error.message || "unknown"}`,
    );
  }
  const request = (requestSelect.data ?? null) as RequestRow | null;
  const profileIds = Array.from(
    new Set(
      [onsite.professional_id, onsite.client_id].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );
  const profileNames = new Map<string, string | null>();
  if (profileIds.length > 0) {
    const profilesSelect = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    if (profilesSelect.error) {
      logOnsiteDiagnostic("finalize.profile_lookup.error", {
        onsiteRequestId,
        error: serializeError(profilesSelect.error),
      });
    } else {
      for (const row of (profilesSelect.data ?? []) as ProfileSummaryRow[]) {
        profileNames.set(row.id, row.full_name ?? null);
      }
    }
  }

  const breakdown = resolveDepositBreakdownCents({
    metadata: args.metadata,
    onsite,
    amountTotalCents:
      typeof args.amountTotalCents === "number" &&
      Number.isFinite(args.amountTotalCents)
        ? args.amountTotalCents
        : null,
  });

  const alreadyPaid =
    String(onsite.status || "").toLowerCase() === "deposit_paid";
  let updated = false;

  if (!alreadyPaid) {
    const updatePayload: Database["public"]["Tables"]["onsite_quote_requests"]["Update"] =
      {
        status: "deposit_paid",
        deposit_paid_at: onsite.deposit_paid_at ?? nowIso,
        deposit_payment_intent_id:
          args.paymentIntentId ?? onsite.deposit_payment_intent_id ?? null,
        deposit_base_cents: breakdown.baseCents,
        deposit_fee_cents: breakdown.feeCents,
        deposit_iva_cents: breakdown.ivaCents,
        deposit_total_cents: breakdown.totalCents,
      };
    const updateResult = await admin
      .from("onsite_quote_requests")
      .update(updatePayload)
      .eq("id", onsite.id)
      .neq("status", "deposit_paid")
      .select("id, status")
      .maybeSingle();

    if (updateResult.error) {
      logOnsiteDiagnostic("finalize.onsite_update.error", {
        onsiteRequestId,
        updatePayload,
        error: serializeError(updateResult.error),
      });
      throw new Error(
        `ONSITE_UPDATE_FAILED:${updateResult.error.message || "unknown"}`,
      );
    }

    updated = Boolean(updateResult.data?.id);
    logOnsiteDiagnostic("finalize.onsite_update.result", {
      onsiteRequestId,
      updated,
      updatePayload,
      row: updateResult.data ?? null,
    });
  } else {
    const reconciliation: Database["public"]["Tables"]["onsite_quote_requests"]["Update"] =
      {};
    if (!onsite.deposit_payment_intent_id && args.paymentIntentId) {
      reconciliation.deposit_payment_intent_id = args.paymentIntentId;
    }
    if (onsite.deposit_base_cents == null && breakdown.baseCents != null) {
      reconciliation.deposit_base_cents = breakdown.baseCents;
    }
    if (onsite.deposit_fee_cents == null && breakdown.feeCents != null) {
      reconciliation.deposit_fee_cents = breakdown.feeCents;
    }
    if (onsite.deposit_iva_cents == null && breakdown.ivaCents != null) {
      reconciliation.deposit_iva_cents = breakdown.ivaCents;
    }
    if (onsite.deposit_total_cents == null && breakdown.totalCents != null) {
      reconciliation.deposit_total_cents = breakdown.totalCents;
    }
    if (Object.keys(reconciliation).length > 0) {
      const reconciliationResult = await admin
        .from("onsite_quote_requests")
        .update(reconciliation)
        .eq("id", onsite.id)
        .select("id")
        .maybeSingle();
      if (reconciliationResult.error) {
        logOnsiteDiagnostic("finalize.onsite_reconciliation.error", {
          onsiteRequestId,
          reconciliation,
          error: serializeError(reconciliationResult.error),
        });
        throw new Error(
          `ONSITE_RECONCILIATION_FAILED:${reconciliationResult.error.message || "unknown"}`,
        );
      }
    }
  }

  const refreshedSelect = await admin
    .from("onsite_quote_requests")
    .select(
      "id, conversation_id, request_id, professional_id, client_id, status, is_remunerable, deposit_amount, deposit_checkout_url, deposit_payment_intent_id, deposit_paid_at, deposit_base_cents, deposit_fee_cents, deposit_iva_cents, deposit_total_cents, schedule_date, schedule_time_start, schedule_time_end, details, notes",
    )
    .eq("id", onsite.id)
    .maybeSingle();
  if (refreshedSelect.error) {
    logOnsiteDiagnostic("finalize.onsite_refresh.error", {
      onsiteRequestId,
      error: serializeError(refreshedSelect.error),
    });
    throw new Error(
      `ONSITE_REFRESH_FAILED:${refreshedSelect.error.message || "unknown"}`,
    );
  }
  const refreshed = (refreshedSelect.data ?? onsite) as OnsiteRow;
  let adminPaymentInserted = false;
  let onsitePayoutCreated = false;

  try {
    const paymentMeta = {
      payment_type: "onsite_quote",
      type: "onsite_deposit",
      onsite_request_id: refreshed.id,
      onsite_quote_request_id: refreshed.id,
      conversation_id: conversationId,
      request_id: requestId,
      professional_id: refreshed.professional_id,
      client_id: refreshed.client_id,
      is_remunerable: refreshed.is_remunerable === true,
      deposit_base_cents: breakdown.baseCents,
      deposit_fee_cents: breakdown.feeCents,
      deposit_iva_cents: breakdown.ivaCents,
      deposit_total_cents: breakdown.totalCents,
      source: args.source,
    } as Record<string, unknown>;
    const paymentResult = await recordPayment({
      admin,
      requestId,
      amount: Number((breakdown.baseCents ?? 0) / 100),
      fee: Number((breakdown.feeCents ?? 0) / 100),
      vat: Number((breakdown.ivaCents ?? 0) / 100),
      currency: "MXN",
      status: "paid",
      paymentIntentId:
        args.paymentIntentId ?? refreshed.deposit_payment_intent_id ?? null,
      createdAt: refreshed.deposit_paid_at ?? nowIso,
      metadata: paymentMeta,
    });
    adminPaymentInserted = paymentResult.inserted;
    logOnsiteDiagnostic("finalize.payment_record.result", {
      onsiteRequestId,
      paymentIntentId:
        args.paymentIntentId ?? refreshed.deposit_payment_intent_id ?? null,
      inserted: paymentResult.inserted,
      ok: paymentResult.ok,
    });
  } catch (error) {
    logOnsiteDiagnostic("finalize.payment_record.error", {
      onsiteRequestId,
      error: serializeError(error),
    });
  }

  try {
    onsitePayoutCreated = await upsertOnsitePayout({
      admin,
      onsite: refreshed,
      requestId,
      professionalProfileId: refreshed.professional_id,
      paymentIntentId:
        args.paymentIntentId ?? refreshed.deposit_payment_intent_id ?? null,
      conversationId,
      breakdown,
    });
    logOnsiteDiagnostic("finalize.payout.result", {
      onsiteRequestId,
      created: onsitePayoutCreated,
      requestId,
      professionalProfileId: refreshed.professional_id ?? null,
    });
  } catch (error) {
    logOnsiteDiagnostic("finalize.payout.error", {
      onsiteRequestId,
      error: serializeError(error),
    });
  }

  let messageEnsured = false;
  let professionalNotificationCreated = false;
  let clientNotificationCreated = false;
  let calendarUpserted = false;

  try {
    messageEnsured = await ensurePaidSystemMessage({
      admin,
      conversationId,
      senderId: clientUserId ?? professionalUserId,
      onsite: refreshed,
    });
    logOnsiteDiagnostic("finalize.message.result", {
      onsiteRequestId,
      messageEnsured,
      conversationId,
    });
  } catch (error) {
    logOnsiteDiagnostic("finalize.message.error", {
      onsiteRequestId,
      conversationId,
      error: serializeError(error),
    });
    throw error instanceof Error
      ? error
      : new Error("ONSITE_PAID_MESSAGE_FAILED");
  }

  try {
    calendarUpserted = await upsertProfessionalCalendar({
      admin,
      professionalUserId,
      requestId,
      requestTitle: request?.title ?? null,
      onsite: refreshed,
    });
    logOnsiteDiagnostic("finalize.calendar.result", {
      onsiteRequestId,
      calendarUpserted,
      professionalUserId,
      requestId,
    });
  } catch (error) {
    logOnsiteDiagnostic("finalize.calendar.error", {
      onsiteRequestId,
      professionalUserId,
      requestId,
      error: serializeError(error),
    });
    throw error instanceof Error ? error : new Error("ONSITE_CALENDAR_FAILED");
  }

  const requestTitle = request?.title?.trim() || "Solicitud sin título";
  const professionalName =
    profileNames.get(refreshed.professional_id ?? "") ||
    refreshed.professional_id ||
    "Profesional";
  const clientName =
    profileNames.get(refreshed.client_id ?? "") ||
    refreshed.client_id ||
    "Cliente";
  const onsiteAmountText = formatMoneyMx(
    Number((breakdown.baseCents ?? 0) / 100),
  );
  const remunerationLabel =
    refreshed.is_remunerable === true ? "Remunerable" : "No remunerable";

  if (updated && conversationId) {
    try {
      professionalNotificationCreated = await insertUserNotification({
        admin,
        userId: professionalUserId,
        type: "onsite_quote",
        title: "Cotización en sitio pagada",
        body: "El cliente pagó la cotización en sitio.",
        link: `/mensajes/${encodeURIComponent(conversationId)}`,
      });
      clientNotificationCreated = await insertUserNotification({
        admin,
        userId: clientUserId,
        type: "onsite_quote",
        title: "Pago onsite procesado",
        body: "Tu pago de cotización en sitio fue procesado.",
        link: `/mensajes/${encodeURIComponent(conversationId)}`,
      });
      await notifyChatMessageByConversation({
        conversationId,
        senderId: clientUserId ?? professionalUserId ?? "system",
        text: "Pago de cotización en sitio confirmado",
      });
      await notifyPush({
        userId: professionalUserId,
        title: "Cotización en sitio pagada",
        body: "El cliente pagó la cotización en sitio.",
        conversationId,
        onsiteRequestId,
      });
      await notifyPush({
        userId: clientUserId,
        title: "Pago onsite procesado",
        body: "Tu pago de cotización en sitio fue procesado.",
        conversationId,
        onsiteRequestId,
      });
      logOnsiteDiagnostic("finalize.notifications.result", {
        onsiteRequestId,
        professionalNotificationCreated,
        clientNotificationCreated,
        conversationId,
        adminPaymentInserted,
        onsitePayoutCreated,
      });
    } catch (error) {
      logOnsiteDiagnostic("finalize.notifications.error", {
        onsiteRequestId,
        conversationId,
        error: serializeError(error),
      });
      throw error instanceof Error
        ? error
        : new Error("ONSITE_NOTIFICATIONS_FAILED");
    }
  }

  if (adminPaymentInserted) {
    try {
      await notifyAdminsInApp(admin, {
        type: "payment:onsite_quote",
        title: "Pago de cotización en sitio recibido",
        body: `${requestTitle} • ${clientName} • ${professionalName} • ${onsiteAmountText} • ${remunerationLabel}`,
        link: "/admin/payments",
      });
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000";
      await notifyAdminsEmail({
        subject: "HANDI - Pago de cotización en sitio recibido",
        html: `
          <p>Se registró un pago de cotización en sitio.</p>
          <ul>
            <li>Solicitud: <strong>${requestTitle}</strong></li>
            <li>Cliente: <strong>${clientName}</strong></li>
            <li>Profesional: <strong>${professionalName}</strong></li>
            <li>Monto base: <strong>${onsiteAmountText}</strong></li>
            <li>Tipo: <strong>${remunerationLabel}</strong></li>
          </ul>
          <p><a href="${base}/admin/payments">Abrir pagos</a></p>
        `,
      });
    } catch (error) {
      logOnsiteDiagnostic("finalize.admin_notifications.error", {
        onsiteRequestId,
        error: serializeError(error),
      });
    }
  }

  try {
    if (conversationId) {
      revalidatePath(`/mensajes/${conversationId}`);
    }
    if (requestId) {
      revalidatePath(`/requests/explore/${requestId}`);
      revalidatePath(`/requests/${requestId}`);
    }
    revalidatePath("/pro/calendar");
    revalidateTag("pro-calendar");
  } catch (error) {
    logOnsiteDiagnostic("finalize.revalidate.error", {
      onsiteRequestId,
      conversationId,
      requestId,
      error: serializeError(error),
    });
  }

  logOnsiteDiagnostic("finalize.done", {
    onsiteRequestId,
    source: args.source,
    alreadyPaid,
    updated,
    conversationId,
    requestId,
    professionalUserId,
    clientUserId,
    messageEnsured,
    professionalNotificationCreated,
    clientNotificationCreated,
    calendarUpserted,
    adminPaymentInserted,
    onsitePayoutCreated,
    refreshedStatus: refreshed.status ?? null,
  });

  return {
    ok: true,
    alreadyPaid,
    updated,
    onsiteRequestId,
    conversationId,
    requestId,
    professionalUserId,
    clientUserId,
    messageEnsured,
    professionalNotificationCreated,
    clientNotificationCreated,
    calendarUpserted,
  };
}
