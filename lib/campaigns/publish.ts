import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import {
  ingestCampaignAnalytics,
  recordPublishJobPerformanceSnapshot,
  summarizePublishTargets,
} from "@/lib/campaigns/analytics";
import { recalculateCampaignVariantDecisions } from "@/lib/campaigns/winners";
import { getCampaignDetail } from "@/lib/campaigns/repository";
import {
  type CampaignDecisionEligibility,
  type CampaignDecisionSource,
  type CampaignMessageView,
  type CampaignPublishJobRow,
  type CampaignPublishMode,
  type CampaignPublishQueueStatus,
  type CampaignPublishStatus,
  type CampaignVariantDecisionRow,
  type PublishChannel,
  normalizePublishQueueDeferredReason,
  normalizePublishQueueErrorType,
  normalizePublishQueueStatus,
  normalizePublishStatus,
} from "@/lib/campaigns/workflow";
import {
  executePublishConnector,
  getPublishConnector,
} from "@/lib/publish/index";
import type { PublishTargeting } from "@/lib/publish/types";
import { syncCampaignCreativeBundles } from "@/lib/creative/bundles";
import {
  evaluateChannelVisualReadiness,
  isVisualReadinessBlocked,
} from "@/lib/creative/readiness";

type AdminSupabase = SupabaseClient<Database>;

type PublishExecutionResult = {
  ok: boolean;
  job: CampaignPublishJobRow;
  draftId: string;
  messageId: string | null;
  channel: PublishChannel;
  mode: CampaignPublishMode;
  errorMessage: string | null;
};

type CreatePublishJobInput = {
  campaignId: string;
  channel: PublishChannel;
  messageId: string | null;
  mode: CampaignPublishMode;
  triggeredBy: string | null;
  providerName: string;
  providerResponseSummary?: string;
  payload?: Record<string, unknown>;
  publishStatus?: CampaignPublishStatus;
  queueStatus?: CampaignPublishQueueStatus;
  scheduledFor?: string | null;
  executionWindowStart?: string | null;
  executionWindowEnd?: string | null;
  retryCount?: number;
  maxRetries?: number;
  nextRetryAt?: string | null;
  lastError?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  triggeredManually?: boolean;
};

type UpdatePublishJobInput = Partial<{
  message_id: string | null;
  publish_status: CampaignPublishStatus;
  queue_status: CampaignPublishQueueStatus;
  publish_mode: CampaignPublishMode;
  provider_name: string;
  provider_response_summary: string;
  payload: Record<string, unknown>;
  external_reference_id: string | null;
  error_message: string | null;
  error_type: string | null;
  deferred_reason: string | null;
  scheduled_for: string | null;
  execution_window_start: string | null;
  execution_window_end: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  triggered_manually: boolean;
  completed_at: string | null;
}>;

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function mapDecisionSource(value: unknown): CampaignDecisionSource {
  return value === "manual" ? "manual" : "rule_based";
}

function mapDecisionEligibility(value: unknown): CampaignDecisionEligibility {
  if (value === "eligible") return "eligible";
  if (value === "manual_only") return "manual_only";
  if (value === "not_supported") return "not_supported";
  return "limited";
}

function mapVariantDecisionRow(
  value: Record<string, unknown>,
): CampaignVariantDecisionRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readString(value.campaign_message_id),
    channel: readString(value.channel) as PublishChannel,
    decision_status:
      value.decision_status === "winner"
        ? "winner"
        : value.decision_status === "candidate"
          ? "candidate"
          : value.decision_status === "loser"
            ? "loser"
            : value.decision_status === "manual_only"
              ? "manual_only"
              : value.decision_status === "archived"
                ? "archived"
                : "insufficient_data",
    decision_source: mapDecisionSource(value.decision_source),
    decision_eligibility: mapDecisionEligibility(value.decision_eligibility),
    sufficient_data: value.sufficient_data === true,
    sufficient_data_reason: readNullableString(value.sufficient_data_reason),
    decision_reason: readNullableString(value.decision_reason),
    decided_by: readNullableString(value.decided_by),
    decided_at: readString(value.decided_at),
    metadata: readRecord(value.metadata),
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

export function mapPublishJobRow(
  value: Record<string, unknown>,
): CampaignPublishJobRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    channel: readString(value.channel) as PublishChannel,
    message_id: readNullableString(value.message_id),
    publish_status: normalizePublishStatus(value.publish_status),
    publish_mode: readString(value.publish_mode) as CampaignPublishMode,
    queue_status: normalizePublishQueueStatus(value.queue_status),
    provider_name: readString(value.provider_name),
    provider_response_summary: readString(value.provider_response_summary),
    payload: readRecord(value.payload),
    external_reference_id: readNullableString(value.external_reference_id),
    error_message: readNullableString(value.error_message),
    error_type: normalizePublishQueueErrorType(value.error_type),
    deferred_reason: normalizePublishQueueDeferredReason(value.deferred_reason),
    scheduled_for: readNullableString(value.scheduled_for),
    execution_window_start: readNullableString(value.execution_window_start),
    execution_window_end: readNullableString(value.execution_window_end),
    retry_count: readNumber(value.retry_count, 0),
    max_retries: readNumber(value.max_retries, 2),
    next_retry_at: readNullableString(value.next_retry_at),
    last_error: readNullableString(value.last_error),
    locked_at: readNullableString(value.locked_at),
    locked_by: readNullableString(value.locked_by),
    triggered_manually: readBoolean(value.triggered_manually),
    triggered_by: readNullableString(value.triggered_by),
    triggered_at: readString(value.triggered_at),
    completed_at: readNullableString(value.completed_at),
  };
}

function parseList(value: string | undefined) {
  return (value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTargeting(input: {
  targetEmails?: string;
  targetUserIds?: string;
  targetPhone?: string;
}): PublishTargeting {
  return {
    targetEmails: parseList(input.targetEmails),
    targetUserIds: parseList(input.targetUserIds),
    targetPhone: input.targetPhone?.trim() || null,
  };
}

export function extractTargetingFromPayload(
  payload: Record<string, unknown>,
): PublishTargeting {
  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : Array.isArray(payload.targets)
      ? []
      : [];
  const targetUserIds = Array.isArray(payload.targetUserIds)
    ? payload.targetUserIds.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const targetEmailFallback =
    Array.isArray(payload.targets) &&
    payload.targets.every((item) => typeof item === "string")
      ? (payload.targets as string[])
      : [];

  return {
    targetEmails: recipients.length ? recipients : targetEmailFallback,
    targetUserIds,
    targetPhone: readNullableString(payload.targetPhone),
  };
}

function rankMessage(message: CampaignMessageView) {
  return [
    message.status === "approved" ? 1 : 0,
    message.qa_report.overall_score,
    message.updated_at,
    message.created_at,
  ].join(":");
}

function chooseTopRankedMessage(
  messages: CampaignMessageView[],
): CampaignMessageView | null {
  return (
    [...messages].sort((left, right) =>
      rankMessage(right).localeCompare(rankMessage(left)),
    )[0] || null
  );
}

function chooseMessageForChannel(args: {
  channel: PublishChannel;
  messages: CampaignMessageView[];
}): CampaignMessageView | null {
  const preferredChannels: PublishChannel[] =
    args.channel === "google"
      ? ["meta", "landing", "email", "push", "whatsapp", "google"]
      : [args.channel];

  for (const channel of preferredChannels) {
    const match = chooseTopRankedMessage(
      args.messages.filter((message) => message.channel === channel),
    );
    if (match) return match;
  }

  return chooseTopRankedMessage(args.messages);
}

function chooseDecisionMessage(args: {
  channel: PublishChannel;
  decisions: CampaignVariantDecisionRow[];
  messages: CampaignMessageView[];
  source: CampaignDecisionSource;
  requireEligible?: boolean;
}) {
  const decision = args.decisions.find((row) => {
    if (row.channel !== args.channel) return false;
    if (row.decision_status !== "winner") return false;
    if (row.decision_source !== args.source) return false;
    if (args.requireEligible && row.decision_eligibility !== "eligible") {
      return false;
    }
    return true;
  });

  if (!decision) return null;
  return (
    args.messages.find(
      (message) => message.id === decision.campaign_message_id,
    ) || null
  );
}

export function selectPublishMessage(args: {
  channel: PublishChannel;
  messages: CampaignMessageView[];
  decisions: CampaignVariantDecisionRow[];
  preferredMessageId?: string | null;
}) {
  if (args.preferredMessageId) {
    const preferred = args.messages.find(
      (message) => message.id === args.preferredMessageId,
    );
    if (preferred) return preferred;
  }

  const manualWinner = chooseDecisionMessage({
    channel: args.channel,
    decisions: args.decisions,
    messages: args.messages,
    source: "manual",
  });
  if (manualWinner) return manualWinner;

  const analyticWinner = chooseDecisionMessage({
    channel: args.channel,
    decisions: args.decisions,
    messages: args.messages,
    source: "rule_based",
    requireEligible: true,
  });
  if (analyticWinner) return analyticWinner;

  const approvedCurrent = chooseTopRankedMessage(
    args.messages.filter(
      (message) =>
        (message.channel === args.channel ||
          (args.channel === "google" &&
            ["meta", "landing", "email", "push", "whatsapp"].includes(
              message.channel,
            ))) &&
        message.status === "approved",
    ),
  );
  if (approvedCurrent) return approvedCurrent;

  return chooseMessageForChannel({
    channel: args.channel,
    messages: args.messages,
  });
}

export async function updateDraftPublishState(
  admin: AdminSupabase,
  campaignId: string,
  patch: {
    publish_status: CampaignPublishStatus;
    publish_ready_at?: string | null;
    published_at?: string | null;
    last_publish_error?: string | null;
  },
) {
  const { error } = await admin
    .from("campaign_drafts")
    .update(patch as never)
    .eq("id", campaignId);

  if (error) {
    throw new Error(
      error.message || "failed to update campaign publish status",
    );
  }
}

export async function createPublishJob(
  admin: AdminSupabase,
  input: CreatePublishJobInput,
) {
  const publishStatus =
    input.publishStatus ||
    (input.queueStatus === "running" ? "publishing" : "ready_to_publish");
  const queueStatus = input.queueStatus || "ready";
  const payload = input.payload || {};

  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .insert({
      campaign_draft_id: input.campaignId,
      channel: input.channel,
      message_id: input.messageId,
      publish_status: publishStatus,
      publish_mode: input.mode,
      queue_status: queueStatus,
      provider_name: input.providerName,
      provider_response_summary:
        input.providerResponseSummary ||
        (queueStatus === "running"
          ? "Publish job started."
          : "Publish job queued."),
      payload,
      external_reference_id: null,
      error_message: null,
      error_type: null,
      deferred_reason: null,
      scheduled_for: input.scheduledFor || null,
      execution_window_start: input.executionWindowStart || null,
      execution_window_end: input.executionWindowEnd || null,
      retry_count: input.retryCount || 0,
      max_retries: input.maxRetries ?? 2,
      next_retry_at: input.nextRetryAt || null,
      last_error: input.lastError || null,
      locked_at: input.lockedAt || null,
      locked_by: input.lockedBy || null,
      triggered_manually: input.triggeredManually === true,
      triggered_by: input.triggeredBy,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to create publish job");
  }

  return mapPublishJobRow(data as Record<string, unknown>);
}

export async function loadPublishJob(
  admin: AdminSupabase,
  jobId: string,
): Promise<CampaignPublishJobRow> {
  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "failed to load publish job");
  }
  if (!data) {
    throw new Error("publish job not found");
  }

  return mapPublishJobRow(data as Record<string, unknown>);
}

export async function updatePublishJob(
  admin: AdminSupabase,
  jobId: string,
  patch: UpdatePublishJobInput,
) {
  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .update(patch as never)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to update publish job");
  }

  return mapPublishJobRow(data as Record<string, unknown>);
}

export async function lockPublishJob(args: {
  admin: AdminSupabase;
  jobId: string;
  lockedBy: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await args.admin
    .from("campaign_publish_jobs")
    .update({
      locked_at: now,
      locked_by: args.lockedBy,
      queue_status: "running",
      publish_status: "publishing",
      completed_at: null,
    } as never)
    .eq("id", args.jobId)
    .is("locked_at", null)
    .in("queue_status", ["queued", "scheduled", "ready", "failed"])
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "failed to lock publish job");
  }

  return data ? mapPublishJobRow(data as Record<string, unknown>) : null;
}

function isCampaignPublishable(status: CampaignPublishStatus) {
  return !["not_ready", "paused", "archived"].includes(status);
}

export async function runPublishJob(input: {
  admin: AdminSupabase;
  jobId: string;
  triggeredBy: string | null;
  lockOwner?: string | null;
  targeting?: PublishTargeting;
}) {
  const job = await loadPublishJob(input.admin, input.jobId);
  const detail = await getCampaignDetail(input.admin, job.campaign_draft_id);
  if (!detail) {
    throw new Error("campaign not found");
  }
  if (detail.draft.status !== "approved") {
    throw new Error("Only approved campaigns can be published.");
  }
  if (!isCampaignPublishable(detail.draft.publish_status)) {
    throw new Error(
      "Campaign is not publishable until it is ready, active, and not archived.",
    );
  }

  const connector = getPublishConnector(job.channel);
  if (!connector) {
    throw new Error(`Unsupported publish channel: ${job.channel}`);
  }
  if (!connector.supportedModes.includes(job.publish_mode)) {
    throw new Error(
      `${connector.label} only supports ${connector.supportedModes.join(", ")} mode(s).`,
    );
  }

  const targeting =
    input.targeting || extractTargetingFromPayload(job.payload || {});
  const message = selectPublishMessage({
    channel: job.channel,
    messages: detail.messages,
    decisions: detail.variantDecisions,
    preferredMessageId: job.message_id,
  });
  const [creativeBundle] = await syncCampaignCreativeBundles({
    admin: input.admin,
    campaignId: detail.draft.id,
    channels: [job.channel],
  });
  const visualReadiness = evaluateChannelVisualReadiness({
    channel: job.channel,
    bundle: creativeBundle,
  });
  if (isVisualReadinessBlocked(visualReadiness)) {
    throw new Error(
      `Visual readiness blocked for ${job.channel}: ${visualReadiness.summary}`,
    );
  }

  await updateDraftPublishState(input.admin, detail.draft.id, {
    publish_status: "publishing",
    last_publish_error: null,
  });

  const runningJob = await updatePublishJob(input.admin, job.id, {
    message_id: message?.id || null,
    publish_status: "publishing",
    queue_status: "running",
    provider_name: connector.channel,
    provider_response_summary: "Publish job started.",
    payload: {
      ...job.payload,
      channel: job.channel,
      targets: targeting,
      creativeBundle: creativeBundle
        ? {
            channel: creativeBundle.channel,
            requiredFormat: creativeBundle.required_format,
            suitabilityStatus: creativeBundle.suitability_status,
            selectionSource: creativeBundle.selection_source,
            selectedAssetId: creativeBundle.selected_asset?.id || null,
          }
        : null,
      visualReadiness,
    },
    error_message: null,
    error_type: null,
    deferred_reason: null,
    last_error: null,
    locked_at: job.locked_at || new Date().toISOString(),
    locked_by: input.lockOwner || job.locked_by || "publish-runner",
    completed_at: null,
  });

  try {
    const connectorResult = await executePublishConnector({
      admin: input.admin,
      campaign: detail.draft,
      message,
      publishJobId: runningJob.id,
      channel: job.channel,
      mode: job.publish_mode,
      targeting,
      creativeBundle,
    });

    const finalizedJob = await updatePublishJob(input.admin, runningJob.id, {
      publish_status: connectorResult.publishStatus,
      queue_status:
        connectorResult.publishStatus === "published" ? "completed" : "failed",
      provider_name: connectorResult.providerName,
      provider_response_summary: connectorResult.providerResponseSummary,
      payload: connectorResult.payload,
      external_reference_id: connectorResult.externalReferenceId,
      error_message: connectorResult.errorMessage,
      error_type: null,
      deferred_reason: null,
      last_error: connectorResult.errorMessage,
      locked_at: null,
      locked_by: null,
      completed_at: new Date().toISOString(),
    });

    if (connectorResult.publishStatus === "published") {
      await updateDraftPublishState(input.admin, detail.draft.id, {
        publish_status: "published",
        published_at: finalizedJob.completed_at,
        last_publish_error: null,
      });
    } else {
      await updateDraftPublishState(input.admin, detail.draft.id, {
        publish_status: "publish_failed",
        last_publish_error: connectorResult.errorMessage,
      });
    }

    if (
      connectorResult.analyticsSnapshot?.metrics?.length ||
      connectorResult.analyticsSnapshot?.events?.length
    ) {
      await ingestCampaignAnalytics(input.admin, {
        metrics: connectorResult.analyticsSnapshot.metrics,
        events: connectorResult.analyticsSnapshot.events,
      });
    } else if (!["email", "push"].includes(job.channel)) {
      await recordPublishJobPerformanceSnapshot({
        admin: input.admin,
        campaignId: detail.draft.id,
        messageId: message?.id || null,
        publishJobId: finalizedJob.id,
        channel: job.channel,
        publishMode: job.publish_mode,
        publishStatus: connectorResult.publishStatus,
        targetCount: summarizePublishTargets(targeting),
        recordedAt: finalizedJob.completed_at || finalizedJob.triggered_at,
      });
    }

    await recalculateCampaignVariantDecisions(
      input.admin,
      detail.draft.id,
      input.triggeredBy,
    );

    return {
      ok: connectorResult.publishStatus === "published",
      job: finalizedJob,
      draftId: detail.draft.id,
      messageId: message?.id || null,
      channel: job.channel,
      mode: job.publish_mode,
      errorMessage: connectorResult.errorMessage,
    } satisfies PublishExecutionResult;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unexpected publish error";
    const failedJob = await updatePublishJob(input.admin, runningJob.id, {
      publish_status: "publish_failed",
      queue_status: "failed",
      provider_name: connector.channel,
      provider_response_summary: messageText,
      error_message: messageText,
      error_type: null,
      deferred_reason: null,
      last_error: messageText,
      locked_at: null,
      locked_by: null,
      completed_at: new Date().toISOString(),
    });

    await updateDraftPublishState(input.admin, detail.draft.id, {
      publish_status: "publish_failed",
      last_publish_error: messageText,
    });

    await recordPublishJobPerformanceSnapshot({
      admin: input.admin,
      campaignId: detail.draft.id,
      messageId: message?.id || null,
      publishJobId: failedJob.id,
      channel: job.channel,
      publishMode: job.publish_mode,
      publishStatus: "publish_failed",
      targetCount: summarizePublishTargets(targeting),
      recordedAt: failedJob.completed_at || failedJob.triggered_at,
    });
    await recalculateCampaignVariantDecisions(
      input.admin,
      detail.draft.id,
      input.triggeredBy,
    );

    return {
      ok: false,
      job: failedJob,
      draftId: detail.draft.id,
      messageId: message?.id || null,
      channel: job.channel,
      mode: job.publish_mode,
      errorMessage: messageText,
    } satisfies PublishExecutionResult;
  }
}

export async function markCampaignReadyToPublish(
  admin: AdminSupabase,
  input: { campaignId: string },
) {
  const detail = await getCampaignDetail(admin, input.campaignId);
  if (!detail) throw new Error("campaign not found");
  if (detail.draft.status !== "approved") {
    throw new Error("Only approved campaigns can be marked ready to publish.");
  }

  const readyAt = new Date().toISOString();
  await updateDraftPublishState(admin, input.campaignId, {
    publish_status: "ready_to_publish",
    publish_ready_at: readyAt,
    last_publish_error: null,
  });

  return {
    ...detail.draft,
    publish_status: "ready_to_publish" as const,
    publish_ready_at: readyAt,
    last_publish_error: null,
  };
}

export async function pauseCampaignPublishing(
  admin: AdminSupabase,
  input: { campaignId: string },
) {
  const detail = await getCampaignDetail(admin, input.campaignId);
  if (!detail) throw new Error("campaign not found");

  await updateDraftPublishState(admin, input.campaignId, {
    publish_status: "paused",
  });

  const { error } = await admin
    .from("campaign_publish_jobs")
    .update({
      queue_status: "paused",
      publish_status: "paused",
      locked_at: null,
      locked_by: null,
      last_error: "Publishing paused by admin.",
      error_message: "Publishing paused by admin.",
      error_type: null,
      deferred_reason: null,
    } as never)
    .eq("campaign_draft_id", input.campaignId)
    .in("queue_status", ["queued", "scheduled", "ready", "running"]);

  if (error) {
    throw new Error(error.message || "failed to pause scheduled publish jobs");
  }

  return {
    ...detail.draft,
    publish_status: "paused" as const,
  };
}

export async function publishCampaign(input: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  publishMode?: CampaignPublishMode;
  targeting?: PublishTargeting;
  triggeredBy: string | null;
}): Promise<PublishExecutionResult> {
  const connector = getPublishConnector(input.channel);
  if (!connector) {
    throw new Error(`Unsupported publish channel: ${input.channel}`);
  }
  const mode = input.publishMode || connector.defaultMode;
  if (!connector.supportedModes.includes(mode)) {
    throw new Error(
      `${connector.label} only supports ${connector.supportedModes.join(", ")} mode(s).`,
    );
  }

  const job = await createPublishJob(input.admin, {
    campaignId: input.campaignId,
    channel: input.channel,
    messageId: null,
    mode,
    triggeredBy: input.triggeredBy,
    providerName: connector.channel,
    providerResponseSummary: "Manual publish started.",
    payload: {
      channel: input.channel,
      targets: input.targeting || {
        targetEmails: [],
        targetUserIds: [],
        targetPhone: null,
      },
    },
    publishStatus: "publishing",
    queueStatus: "running",
    lockedAt: new Date().toISOString(),
    lockedBy: input.triggeredBy || "manual-publish",
    triggeredManually: true,
  });

  return runPublishJob({
    admin: input.admin,
    jobId: job.id,
    triggeredBy: input.triggeredBy,
    lockOwner: input.triggeredBy || "manual-publish",
    targeting: input.targeting,
  });
}

export async function retryPublishJob(input: {
  admin: AdminSupabase;
  jobId: string;
  triggeredBy: string | null;
}) {
  const job = await loadPublishJob(input.admin, input.jobId);
  const targeting = extractTargetingFromPayload(job.payload);

  return publishCampaign({
    admin: input.admin,
    campaignId: job.campaign_draft_id,
    channel: job.channel,
    publishMode: job.publish_mode,
    targeting,
    triggeredBy: input.triggeredBy,
  });
}

export function parsePublishTargeting(input: {
  targetEmails?: string;
  targetUserIds?: string;
  targetPhone?: string;
}) {
  return buildTargeting(input);
}

export async function loadCampaignVariantDecisions(
  admin: AdminSupabase,
  campaignId: string,
) {
  const { data, error } = await admin
    .from("campaign_variant_decisions")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "failed to load variant decisions");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapVariantDecisionRow(row as Record<string, unknown>),
  );
}
