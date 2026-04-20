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
  type CampaignMessageView,
  type CampaignPublishJobRow,
  type CampaignPublishMode,
  type CampaignPublishStatus,
  type PublishChannel,
  normalizePublishStatus,
} from "@/lib/campaigns/workflow";
import {
  executePublishConnector,
  getPublishConnector,
} from "@/lib/publish/index";
import type { PublishTargeting } from "@/lib/publish/types";

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

function mapPublishJobRow(
  value: Record<string, unknown>,
): CampaignPublishJobRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    channel: readString(value.channel) as PublishChannel,
    message_id: readNullableString(value.message_id),
    publish_status: normalizePublishStatus(value.publish_status),
    publish_mode: readString(value.publish_mode) as CampaignPublishMode,
    provider_name: readString(value.provider_name),
    provider_response_summary: readString(value.provider_response_summary),
    payload: readRecord(value.payload),
    external_reference_id: readNullableString(value.external_reference_id),
    error_message: readNullableString(value.error_message),
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

function extractTargetingFromPayload(
  payload: Record<string, unknown>,
): PublishTargeting {
  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const targetUserIds = Array.isArray(payload.targetUserIds)
    ? payload.targetUserIds.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];

  return {
    targetEmails: recipients,
    targetUserIds,
    targetPhone: readNullableString(payload.targetPhone),
  };
}

function rankMessage(message: CampaignMessageView) {
  return [
    message.qa_report.overall_score,
    message.updated_at,
    message.created_at,
  ].join(":");
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
    const match = args.messages
      .filter((message) => message.channel === channel)
      .sort((left, right) =>
        rankMessage(right).localeCompare(rankMessage(left)),
      )[0];
    if (match) return match;
  }

  return (
    [...args.messages].sort((left, right) =>
      rankMessage(right).localeCompare(rankMessage(left)),
    )[0] || null
  );
}

async function updateDraftPublishState(
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

async function createPublishJob(
  admin: AdminSupabase,
  input: {
    campaignId: string;
    channel: PublishChannel;
    messageId: string | null;
    mode: CampaignPublishMode;
    triggeredBy: string | null;
    providerName: string;
    providerResponseSummary?: string;
    payload?: Record<string, unknown>;
  },
) {
  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .insert({
      campaign_draft_id: input.campaignId,
      channel: input.channel,
      message_id: input.messageId,
      publish_status: "publishing",
      publish_mode: input.mode,
      provider_name: input.providerName,
      provider_response_summary:
        input.providerResponseSummary || "Publish job created.",
      payload: input.payload || {},
      triggered_by: input.triggeredBy,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to create publish job");
  }

  return mapPublishJobRow(data as Record<string, unknown>);
}

async function finalizePublishJob(
  admin: AdminSupabase,
  jobId: string,
  input: {
    publish_status: CampaignPublishStatus;
    provider_name: string;
    provider_response_summary: string;
    payload: Record<string, unknown>;
    external_reference_id: string | null;
    error_message: string | null;
  },
) {
  const completedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("campaign_publish_jobs")
    .update({
      publish_status: input.publish_status,
      provider_name: input.provider_name,
      provider_response_summary: input.provider_response_summary,
      payload: input.payload,
      external_reference_id: input.external_reference_id,
      error_message: input.error_message,
      completed_at: completedAt,
    } as never)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to finalize publish job");
  }

  return mapPublishJobRow(data as Record<string, unknown>);
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
  const detail = await getCampaignDetail(input.admin, input.campaignId);
  if (!detail) {
    throw new Error("campaign not found");
  }
  if (detail.draft.status !== "approved") {
    throw new Error("Only approved campaigns can be published.");
  }
  if (detail.draft.publish_status === "not_ready") {
    throw new Error(
      "Mark the campaign ready to publish before starting a publish job.",
    );
  }
  if (detail.draft.publish_status === "archived") {
    throw new Error("Archived campaigns cannot be published.");
  }

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

  const message = chooseMessageForChannel({
    channel: input.channel,
    messages: detail.messages,
  });
  const targeting = input.targeting || {
    targetEmails: [],
    targetUserIds: [],
    targetPhone: null,
  };

  await updateDraftPublishState(input.admin, input.campaignId, {
    publish_status: "publishing",
    last_publish_error: null,
  });

  const startedJob = await createPublishJob(input.admin, {
    campaignId: input.campaignId,
    channel: input.channel,
    messageId: message?.id || null,
    mode,
    triggeredBy: input.triggeredBy,
    providerName: connector.channel,
    providerResponseSummary: "Publish job started.",
    payload: {
      channel: input.channel,
      targets: targeting,
    },
  });

  try {
    const connectorResult = await executePublishConnector({
      admin: input.admin,
      campaign: detail.draft,
      message,
      publishJobId: startedJob.id,
      channel: input.channel,
      mode,
      targeting,
    });

    const finalizedJob = await finalizePublishJob(input.admin, startedJob.id, {
      publish_status: connectorResult.publishStatus,
      provider_name: connectorResult.providerName,
      provider_response_summary: connectorResult.providerResponseSummary,
      payload: connectorResult.payload,
      external_reference_id: connectorResult.externalReferenceId,
      error_message: connectorResult.errorMessage,
    });

    if (connectorResult.publishStatus === "published") {
      await updateDraftPublishState(input.admin, input.campaignId, {
        publish_status: "published",
        published_at: finalizedJob.completed_at,
        last_publish_error: null,
      });
    } else {
      await updateDraftPublishState(input.admin, input.campaignId, {
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
    } else if (!["email", "push"].includes(input.channel)) {
      await recordPublishJobPerformanceSnapshot({
        admin: input.admin,
        campaignId: input.campaignId,
        messageId: message?.id || null,
        publishJobId: finalizedJob.id,
        channel: input.channel,
        publishMode: mode,
        publishStatus: connectorResult.publishStatus,
        targetCount: summarizePublishTargets(targeting),
        recordedAt: finalizedJob.completed_at || finalizedJob.triggered_at,
      });
    }
    await recalculateCampaignVariantDecisions(
      input.admin,
      input.campaignId,
      input.triggeredBy,
    );

    return {
      ok: connectorResult.publishStatus === "published",
      job: finalizedJob,
      draftId: input.campaignId,
      messageId: message?.id || null,
      channel: input.channel,
      mode,
      errorMessage: connectorResult.errorMessage,
    };
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unexpected publish error";
    const finalizedJob = await finalizePublishJob(input.admin, startedJob.id, {
      publish_status: "publish_failed",
      provider_name: connector.channel,
      provider_response_summary: messageText,
      payload: startedJob.payload,
      external_reference_id: null,
      error_message: messageText,
    });
    await updateDraftPublishState(input.admin, input.campaignId, {
      publish_status: "publish_failed",
      last_publish_error: messageText,
    });

    await recordPublishJobPerformanceSnapshot({
      admin: input.admin,
      campaignId: input.campaignId,
      messageId: message?.id || null,
      publishJobId: finalizedJob.id,
      channel: input.channel,
      publishMode: mode,
      publishStatus: "publish_failed",
      targetCount: summarizePublishTargets(targeting),
      recordedAt: finalizedJob.completed_at || finalizedJob.triggered_at,
    });
    await recalculateCampaignVariantDecisions(
      input.admin,
      input.campaignId,
      input.triggeredBy,
    );

    return {
      ok: false,
      job: finalizedJob,
      draftId: input.campaignId,
      messageId: message?.id || null,
      channel: input.channel,
      mode,
      errorMessage: messageText,
    };
  }
}

export async function retryPublishJob(input: {
  admin: AdminSupabase;
  jobId: string;
  triggeredBy: string | null;
}) {
  const { data, error } = await input.admin
    .from("campaign_publish_jobs")
    .select("*")
    .eq("id", input.jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "failed to load publish job");
  }
  if (!data) {
    throw new Error("publish job not found");
  }

  const job = mapPublishJobRow(data as Record<string, unknown>);
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
