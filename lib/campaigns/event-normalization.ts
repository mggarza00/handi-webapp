import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  PerformanceChannel,
  PerformanceEventType,
} from "@/lib/campaigns/analytics";

export const providerEventStatuses = ["processed", "ignored", "error"] as const;
export const providerEventSources = [
  "webhook",
  "push_client",
  "manual_sync",
] as const;

export type ProviderEventStatus = (typeof providerEventStatuses)[number];
export type ProviderEventSource = (typeof providerEventSources)[number];

export type ResolvedPublishContext = {
  campaignDraftId: string | null;
  campaignMessageId: string | null;
  publishJobId: string | null;
  channel: PerformanceChannel | null;
};

export type NormalizedProviderEvent = {
  providerName: string;
  providerEventId: string | null;
  dedupeKey: string;
  eventSource: ProviderEventSource;
  providerEventType: string;
  normalizedEventType: PerformanceEventType | null;
  campaignDraftId: string | null;
  campaignMessageId: string | null;
  publishJobId: string | null;
  channel: PerformanceChannel | null;
  targetUserId: string | null;
  targetIdentifier: string | null;
  eventTimestamp: string;
  processedStatus: ProviderEventStatus;
  errorMessage: string | null;
  payload: Record<string, unknown>;
  normalizedMetadata: Record<string, unknown>;
  analyticsSource: string;
};

const resendTagSchema = z.record(z.string());
const resendPayloadSchema = z
  .object({
    type: z.string().trim().min(1),
    created_at: z.string().datetime(),
    data: z
      .object({
        email_id: z.string().trim().min(1).optional(),
        to: z.array(z.string().trim().min(1)).optional().default([]),
        subject: z.string().optional(),
        tags: resendTagSchema.optional().default({}),
        click: z
          .object({
            link: z.string().trim().min(1).optional(),
            timestamp: z.string().datetime().optional(),
            userAgent: z.string().optional(),
            ipAddress: z.string().optional(),
          })
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const pushTrackingPayloadSchema = z.object({
  providerEventId: z.string().trim().min(1).optional(),
  eventType: z.enum(["delivered", "clicked", "failed"]),
  campaignId: z.string().uuid(),
  messageId: z.string().uuid().nullable().optional(),
  publishJobId: z.string().uuid(),
  channel: z.literal("push"),
  subscriptionId: z.string().trim().min(1),
  targetUserId: z.string().trim().min(1).nullable().optional(),
  trackingToken: z.string().trim().min(1),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type ResendWebhookPayload = z.infer<typeof resendPayloadSchema>;
export type PushTrackingPayload = z.infer<typeof pushTrackingPayloadSchema>;

export function parseResendWebhookPayload(value: unknown) {
  return resendPayloadSchema.parse(value);
}

export function parsePushTrackingPayload(value: unknown) {
  return pushTrackingPayloadSchema.parse(value);
}

function safeObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function buildDedupeKey(parts: Array<string | null | undefined>) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function mapResendEventType(type: string): PerformanceEventType | null {
  if (type === "email.delivered") return "delivered";
  if (type === "email.opened") return "opened";
  if (type === "email.clicked") return "clicked";
  if (
    type === "email.bounced" ||
    type === "email.failed" ||
    type === "email.complained" ||
    type === "email.delivery_delayed"
  ) {
    return "failed";
  }

  return null;
}

export function normalizeResendWebhookEvents(input: {
  payload: ResendWebhookPayload;
  webhookId: string | null;
  resolvedContext: ResolvedPublishContext;
}) {
  const recipients = input.payload.data.to.length
    ? input.payload.data.to
    : [null];
  const normalizedEventType = mapResendEventType(input.payload.type);
  const emailId = input.payload.data.email_id || null;
  const tags = input.payload.data.tags || {};
  const occurredAt =
    input.payload.data.click?.timestamp ||
    input.payload.created_at ||
    new Date().toISOString();
  const processedStatus: ProviderEventStatus =
    normalizedEventType &&
    input.resolvedContext.campaignDraftId &&
    input.resolvedContext.publishJobId &&
    input.resolvedContext.channel
      ? "processed"
      : input.resolvedContext.publishJobId ||
          input.resolvedContext.campaignDraftId
        ? "ignored"
        : "error";
  const errorMessage =
    processedStatus === "processed"
      ? null
      : processedStatus === "ignored"
        ? "Provider event stored but not mapped to an analytics event."
        : "Provider event could not be matched to a campaign publish job.";

  return recipients.map((recipient) => {
    const providerEventId = input.webhookId
      ? `${input.webhookId}:${recipient || "aggregate"}:${input.payload.type}`
      : emailId
        ? `${emailId}:${recipient || "aggregate"}:${input.payload.type}`
        : null;

    return {
      providerName: "resend",
      providerEventId,
      dedupeKey: buildDedupeKey([
        "resend",
        providerEventId,
        emailId,
        recipient,
        input.payload.type,
      ]),
      eventSource: "webhook" as const,
      providerEventType: input.payload.type,
      normalizedEventType,
      campaignDraftId: input.resolvedContext.campaignDraftId,
      campaignMessageId: input.resolvedContext.campaignMessageId,
      publishJobId: input.resolvedContext.publishJobId,
      channel: input.resolvedContext.channel,
      targetUserId: null,
      targetIdentifier: recipient,
      eventTimestamp: occurredAt,
      processedStatus,
      errorMessage,
      payload: safeObject(input.payload),
      normalizedMetadata: {
        emailId,
        tags,
        subject: input.payload.data.subject || null,
        click: safeObject(input.payload.data.click),
        recipients: recipients.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
      },
      analyticsSource: "resend_webhook",
    } satisfies NormalizedProviderEvent;
  });
}

export function normalizePushTrackingEvent(input: {
  payload: PushTrackingPayload;
  resolvedContext: ResolvedPublishContext;
}) {
  const normalizedEventType =
    input.payload.eventType === "failed" ? "failed" : input.payload.eventType;
  const processedStatus: ProviderEventStatus =
    input.resolvedContext.campaignDraftId &&
    input.resolvedContext.publishJobId &&
    input.resolvedContext.channel
      ? "processed"
      : "error";

  return {
    providerName: "web-push",
    providerEventId:
      input.payload.providerEventId ||
      `${input.payload.publishJobId}:${input.payload.subscriptionId}:${input.payload.eventType}`,
    dedupeKey: buildDedupeKey([
      "web-push",
      input.payload.providerEventId,
      input.payload.publishJobId,
      input.payload.subscriptionId,
      input.payload.eventType,
    ]),
    eventSource: "push_client" as const,
    providerEventType: input.payload.eventType,
    normalizedEventType,
    campaignDraftId: input.resolvedContext.campaignDraftId,
    campaignMessageId: input.resolvedContext.campaignMessageId,
    publishJobId: input.resolvedContext.publishJobId,
    channel: input.resolvedContext.channel,
    targetUserId: input.payload.targetUserId || null,
    targetIdentifier: input.payload.subscriptionId,
    eventTimestamp: input.payload.occurredAt || new Date().toISOString(),
    processedStatus,
    errorMessage:
      processedStatus === "processed"
        ? null
        : "Push callback could not be matched to a publish job.",
    payload: safeObject(input.payload),
    normalizedMetadata: {
      subscriptionId: input.payload.subscriptionId,
      manualMetadata: input.payload.metadata,
      callbackSources: uniqueStrings([
        "push_callback",
        typeof input.payload.metadata?.source === "string"
          ? input.payload.metadata.source
          : null,
      ]),
    },
    analyticsSource: "push_callback",
  } satisfies NormalizedProviderEvent;
}
