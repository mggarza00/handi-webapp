import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignGenerationInput,
  ContentFormat,
  ContentGenerationInput,
  GeneratedMessage,
  ProviderMetadata,
} from "@/lib/ai/schemas";
import { providerMetadataSchema } from "@/lib/ai/schemas";
import { summarizeProviderStatus, toProviderMetadata } from "@/lib/ai/provider";
import type { Database } from "@/types/supabase";
import type {
  GeneratedCampaignProposal,
  GeneratedContentProposal,
} from "@/lib/campaigns/generation";
import { analyzeCampaignQa } from "@/lib/campaigns/qa";
import {
  CAMPAIGN_FEEDBACK_TYPES,
  buildDefaultReviewChecklist,
  buildVariantName,
  labelChannel,
  normalizePublishStatus,
  normalizeCampaignQaReport,
  normalizeMessageQaReport,
  normalizeReviewChecklist,
  parseMessageRationale,
  serializeMessageRationale,
  type CampaignActivityItem,
  type CampaignDraftRow,
  type CampaignFeedbackRow,
  type CampaignFeedbackType,
  type CampaignInternalNoteRow,
  type CampaignListItem,
  type CampaignMessageContent,
  type CampaignMessageRow,
  type CampaignVariantDecisionRow,
  type CampaignPublishJobRow,
  type CampaignPublishStatus,
  type CampaignMessageVersionRow,
  type CampaignMessageView,
  type CampaignReviewChecklist,
  type ReviewerOption,
  type CampaignSortOrder,
  type CampaignVersionAction,
  type CampaignWorkflowStatus,
  normalizeDecisionEligibility,
  normalizeDecisionSource,
  normalizeDecisionStatus,
} from "@/lib/campaigns/workflow";
import { recalculateCampaignVariantDecisions } from "@/lib/campaigns/winners";

type AdminSupabase = SupabaseClient<Database>;

type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

type ListCampaignDraftFilters = {
  status?: CampaignWorkflowStatus | "";
  publishStatus?: CampaignPublishStatus | "";
  audience?: CampaignDraftRow["audience"] | "";
  channel?: CampaignMessageRow["channel"] | "";
  goal?: CampaignDraftRow["goal"] | "";
  owner?: string | "unassigned" | "";
  q?: string;
  sort?: CampaignSortOrder;
  page?: number;
  pageSize?: number;
};

type CampaignDetail = {
  draft: CampaignDraftRow;
  messages: CampaignMessageView[];
  variantDecisions: CampaignVariantDecisionRow[];
  feedback: CampaignFeedbackRow[];
  versions: CampaignMessageVersionRow[];
  internalNotes: CampaignInternalNoteRow[];
  publishJobs: CampaignPublishJobRow[];
  activityFeed: CampaignActivityItem[];
  actorNames: Record<string, string>;
  reviewerOptions: ReviewerOption[];
  sourceCampaign: Pick<CampaignDraftRow, "id" | "title"> | null;
};

type PersistCampaignDraftParams = {
  admin: AdminSupabase;
  createdBy: string | null;
  draft: {
    title: string;
    audience: CampaignDraftRow["audience"];
    goal: CampaignDraftRow["goal"];
    channels: CampaignDraftRow["channels"];
    serviceCategory: string;
    offer: string;
    cta: string;
    journeyTrigger?: string | null;
    notes?: string | null;
    rationaleSummary: string;
    recommendedAngle: string;
    brandContext: CampaignDraftRow["brand_context"];
    channelPlan: CampaignDraftRow["channel_plan"];
    kpiSuggestions: CampaignDraftRow["kpi_suggestions"];
    sourceCampaignDraftId?: string | null;
    generationProvider?: string;
    generationProviderStatus?: string | null;
    providerMetadata?: ProviderMetadata;
    status?: CampaignWorkflowStatus;
  };
  messages: GeneratedMessage[];
};

type EditCampaignMessageParams = {
  admin: AdminSupabase;
  messageId: string;
  createdBy: string | null;
  headline?: string;
  body?: string;
  cta?: string;
  rationaleNote?: string;
};

type RegenerateCampaignMessageParams = {
  admin: AdminSupabase;
  messageId: string;
  createdBy: string | null;
  feedbackNote?: string;
};

type BatchCampaignAction = "approve" | "reject" | "archive";

type AssignCampaignOwnerParams = {
  admin: AdminSupabase;
  campaignId: string;
  ownerUserId: string | null;
};

type CreateCampaignInternalNoteParams = {
  admin: AdminSupabase;
  campaignId: string;
  note: string;
  createdBy: string | null;
};

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string"
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    : false;
}

function actorIdOrNull(value: string | null | undefined): string | null {
  return isUuid(value) ? value : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readProviderMetadata(value: unknown): ProviderMetadata {
  const parsed = providerMetadataSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  return {
    providerName: "mock",
    generationMode: "mock",
    model: null,
    generatedAt: "",
    fallbackReason: null,
    requestId: null,
    note: null,
  };
}

function toMessageContent(value: unknown): CampaignMessageContent {
  const obj = readRecord(value);
  return {
    headline: readString(obj.headline),
    body: readString(obj.body),
    cta: readString(obj.cta),
  };
}

function mapDraftRow(value: Record<string, unknown>): CampaignDraftRow {
  return {
    id: readString(value.id),
    title: readString(value.title),
    audience: readString(value.audience) as CampaignDraftRow["audience"],
    goal: readString(value.goal) as CampaignDraftRow["goal"],
    channels: readStringArray(value.channels) as CampaignDraftRow["channels"],
    service_category: readString(value.service_category),
    offer: readString(value.offer),
    cta: readString(value.cta),
    journey_trigger: readNullableString(value.journey_trigger),
    notes: readNullableString(value.notes),
    rationale_summary: readString(value.rationale_summary),
    recommended_angle: readString(value.recommended_angle),
    brand_context:
      (value.brand_context as CampaignDraftRow["brand_context"]) ||
      ({} as CampaignDraftRow["brand_context"]),
    channel_plan:
      (value.channel_plan as CampaignDraftRow["channel_plan"]) || [],
    kpi_suggestions:
      (value.kpi_suggestions as CampaignDraftRow["kpi_suggestions"]) || [],
    owner_user_id: readNullableString(value.owner_user_id),
    owner_assigned_at: readNullableString(value.owner_assigned_at),
    source_campaign_draft_id: readNullableString(
      value.source_campaign_draft_id,
    ),
    campaign_review_checklist: normalizeReviewChecklist(
      value.campaign_review_checklist,
    ),
    generation_provider: readString(value.generation_provider) || "mock",
    generation_provider_status: readNullableString(
      value.generation_provider_status,
    ),
    provider_metadata: readProviderMetadata(value.provider_metadata),
    qa_report: normalizeCampaignQaReport(value.qa_report),
    publish_status: normalizePublishStatus(value.publish_status),
    publish_ready_at: readNullableString(value.publish_ready_at),
    published_at: readNullableString(value.published_at),
    last_publish_error: readNullableString(value.last_publish_error),
    status: readString(value.status) as CampaignWorkflowStatus,
    created_by: readNullableString(value.created_by),
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

function mapMessageRow(value: Record<string, unknown>): CampaignMessageRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    channel: readString(value.channel) as CampaignMessageRow["channel"],
    format: readString(value.format) as ContentFormat,
    variant_name: readString(value.variant_name),
    content: toMessageContent(value.content),
    rationale: readString(value.rationale),
    provider_metadata: readProviderMetadata(value.provider_metadata),
    qa_report: normalizeMessageQaReport(value.qa_report),
    status: readString(value.status) as CampaignWorkflowStatus,
    created_at: readString(value.created_at),
    updated_at: readString(value.updated_at),
  };
}

function mapFeedbackRow(value: Record<string, unknown>): CampaignFeedbackRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readNullableString(value.campaign_message_id),
    feedback_type: readString(value.feedback_type) as CampaignFeedbackType,
    feedback_note: readNullableString(value.feedback_note),
    created_by: readNullableString(value.created_by),
    created_at: readString(value.created_at),
  };
}

function mapInternalNoteRow(
  value: Record<string, unknown>,
): CampaignInternalNoteRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    note: readString(value.note),
    created_by: readNullableString(value.created_by),
    created_at: readString(value.created_at),
  };
}

function mapPublishJobRow(
  value: Record<string, unknown>,
): CampaignPublishJobRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    channel: readString(value.channel) as CampaignPublishJobRow["channel"],
    message_id: readNullableString(value.message_id),
    publish_status: normalizePublishStatus(value.publish_status),
    publish_mode: readString(
      value.publish_mode,
    ) as CampaignPublishJobRow["publish_mode"],
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

function mapVariantDecisionRow(
  value: Record<string, unknown>,
): CampaignVariantDecisionRow {
  return {
    id: readString(value.id),
    campaign_draft_id: readString(value.campaign_draft_id),
    campaign_message_id: readString(value.campaign_message_id),
    channel: readString(value.channel) as CampaignVariantDecisionRow["channel"],
    decision_status: normalizeDecisionStatus(value.decision_status),
    decision_source: normalizeDecisionSource(value.decision_source),
    decision_eligibility: normalizeDecisionEligibility(
      value.decision_eligibility,
    ),
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

function mapVersionRow(
  value: Record<string, unknown>,
): CampaignMessageVersionRow {
  return {
    id: readString(value.id),
    campaign_message_id: readString(value.campaign_message_id),
    version_number:
      typeof value.version_number === "number" ? value.version_number : 1,
    source_action: readString(value.source_action) as CampaignVersionAction,
    content: toMessageContent(value.content),
    rationale: readString(value.rationale),
    provider_metadata: readProviderMetadata(value.provider_metadata),
    created_by: readNullableString(value.created_by),
    created_at: readString(value.created_at),
  };
}

function mapAuditRow(value: Record<string, unknown>): AuditLogRow {
  return {
    id: readString(value.id),
    actor_id: readNullableString(value.actor_id),
    action: readString(value.action),
    entity: readNullableString(value.entity),
    entity_id: readNullableString(value.entity_id),
    meta: readRecord(value.meta),
    created_at: readString(value.created_at),
  };
}

function serializeMessage(message: GeneratedMessage): CampaignMessageContent {
  return {
    headline: message.headline,
    body: message.body,
    cta: message.cta,
  };
}

function reopenStatusFrom(
  current: CampaignWorkflowStatus,
): CampaignWorkflowStatus {
  if (current === "draft") return "draft";
  if (current === "changes_requested") return "changes_requested";
  return "proposed";
}

function pickLatestTimestamp(...values: Array<string | null | undefined>) {
  const items = values.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (!items.length) return "";
  return items.sort((left, right) => left.localeCompare(right)).at(-1) || "";
}

function mergeBriefNotes(
  notes: string | undefined,
  tonePreference: string | undefined,
) {
  const values = [notes?.trim(), tonePreference?.trim()]
    .filter(Boolean)
    .map((value, index) =>
      index === 1 ? `Tone preference: ${value as string}` : (value as string),
    );

  return values.length ? values.join("\n") : null;
}

function buildEditRationale(args: {
  current: string;
  channel: CampaignMessageRow["channel"];
  cta: string;
  note?: string;
}) {
  const parsed = parseMessageRationale(args.current);
  return serializeMessageRationale({
    angle: parsed.angle || "Copy refined for better clarity and trust.",
    audienceIntent:
      parsed.audienceIntent ||
      "Keep the next step simple, credible, and useful for the audience.",
    whyChannel:
      parsed.whyChannel ||
      `${labelChannel(args.channel)} remains the right format for this moment in the journey.`,
    whyCta:
      parsed.whyCta ||
      `The CTA "${args.cta}" keeps the action specific and low friction.`,
    note: args.note?.trim() || "Manual edit applied by admin.",
    summary: parsed.summary,
  });
}

async function getNextMessageVersionNumber(
  admin: AdminSupabase,
  messageId: string,
): Promise<number> {
  const { data } = await admin
    .from("campaign_message_versions")
    .select("version_number")
    .eq("campaign_message_id", messageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const current =
    (data as { version_number?: number } | null)?.version_number ?? 0;
  return current + 1;
}

async function recordFeedback(
  admin: AdminSupabase,
  input: {
    campaignDraftId: string;
    campaignMessageId?: string | null;
    feedbackType: CampaignFeedbackType;
    feedbackNote?: string | null;
    createdBy?: string | null;
  },
) {
  await admin.from("campaign_feedback").insert({
    campaign_draft_id: input.campaignDraftId,
    campaign_message_id: input.campaignMessageId ?? null,
    feedback_type: input.feedbackType,
    feedback_note: input.feedbackNote ?? null,
    created_by: actorIdOrNull(input.createdBy),
  } as never);
}

async function insertMessageVersion(
  admin: AdminSupabase,
  input: {
    messageId: string;
    versionNumber: number;
    sourceAction: CampaignVersionAction;
    content: CampaignMessageContent;
    rationale: string;
    providerMetadata: ProviderMetadata;
    createdBy?: string | null;
  },
) {
  await admin.from("campaign_message_versions").insert({
    campaign_message_id: input.messageId,
    version_number: input.versionNumber,
    source_action: input.sourceAction,
    content: input.content,
    rationale: input.rationale,
    provider_metadata: input.providerMetadata,
    created_by: actorIdOrNull(input.createdBy),
  } as never);
}

async function loadCampaignDraftWithMessages(
  admin: AdminSupabase,
  campaignId: string,
): Promise<{ draft: CampaignDraftRow; messages: CampaignMessageRow[] }> {
  const { data: draftRow, error: draftError } = await admin
    .from("campaign_drafts")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (draftError || !draftRow) {
    throw new Error(draftError?.message || "campaign draft not found");
  }

  const { data: messageRows, error: messageError } = await admin
    .from("campaign_messages")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("channel", { ascending: true })
    .order("created_at", { ascending: true });

  if (messageError) {
    throw new Error(messageError.message || "failed to load campaign messages");
  }

  return {
    draft: mapDraftRow(draftRow as Record<string, unknown>),
    messages: (Array.isArray(messageRows) ? messageRows : []).map((row) =>
      mapMessageRow(row as Record<string, unknown>),
    ),
  };
}

export async function reanalyzeCampaignQa(
  admin: AdminSupabase,
  campaignId: string,
): Promise<{ draft: CampaignDraftRow; messages: CampaignMessageRow[] }> {
  const { draft, messages } = await loadCampaignDraftWithMessages(
    admin,
    campaignId,
  );
  const analysis = analyzeCampaignQa({
    draft,
    messages,
  });

  const { data: updatedDraftRow, error: draftError } = await admin
    .from("campaign_drafts")
    .update({
      qa_report: analysis.campaignQa,
    } as never)
    .eq("id", campaignId)
    .select("*")
    .single();

  if (draftError || !updatedDraftRow) {
    throw new Error(draftError?.message || "failed to update campaign QA");
  }

  const messageQaUpdates = await Promise.all(
    messages.map((message) =>
      admin
        .from("campaign_messages")
        .update({
          qa_report:
            analysis.messageQaById[message.id] || normalizeMessageQaReport({}),
        } as never)
        .eq("id", message.id),
    ),
  );

  const failedUpdate = messageQaUpdates.find((result) => result.error);
  if (failedUpdate?.error) {
    throw new Error(
      failedUpdate.error.message || "failed to update message QA",
    );
  }

  const refreshed = await loadCampaignDraftWithMessages(admin, campaignId);

  return {
    draft: refreshed.draft,
    messages: refreshed.messages,
  };
}

async function setCampaignStatus(
  admin: AdminSupabase,
  campaignId: string,
  status: CampaignWorkflowStatus,
) {
  const publishPatch =
    status === "archived"
      ? {
          publish_status: "archived",
        }
      : status === "approved"
        ? {}
        : {
            publish_status: "not_ready",
            publish_ready_at: null,
            published_at: null,
            last_publish_error: null,
          };

  const { error: draftError } = await admin
    .from("campaign_drafts")
    .update({ status, ...publishPatch } as never)
    .eq("id", campaignId);

  if (draftError) {
    throw new Error(draftError.message || "failed to update campaign status");
  }

  const { error: messagesError } = await admin
    .from("campaign_messages")
    .update({ status } as never)
    .eq("campaign_draft_id", campaignId);

  if (messagesError) {
    throw new Error(
      messagesError.message || "failed to update message statuses",
    );
  }
}

async function getActorNames(
  admin: AdminSupabase,
  actorIds: string[],
): Promise<Record<string, string>> {
  const uniqueActorIds = Array.from(
    new Set(actorIds.filter((value) => typeof value === "string" && value)),
  );
  if (!uniqueActorIds.length) return {};

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueActorIds);

  const actorNames: Record<string, string> = {};
  (profiles || []).forEach((profile) => {
    const row = readRecord(profile);
    const id = readString(row.id);
    if (!id) return;
    actorNames[id] = readString(row.full_name) || id.slice(0, 8);
  });

  return actorNames;
}

export async function listReviewerOptions(
  admin: AdminSupabase,
): Promise<ReviewerOption[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, role, is_admin")
    .or("is_admin.eq.true,role.in.(admin,owner,ops,finance,support,reviewer)")
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "failed to load reviewer options");
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => {
      const value = readRecord(row);
      const id = readString(value.id);
      if (!id) return null;

      return {
        id,
        label: readString(value.full_name) || id.slice(0, 8),
        email: readNullableString(value.email),
      } satisfies ReviewerOption;
    })
    .filter((item): item is ReviewerOption => Boolean(item));
}

function mapMessageView(
  message: CampaignMessageRow,
  versions: CampaignMessageVersionRow[],
): CampaignMessageView {
  const orderedVersions = [...versions].sort(
    (left, right) => left.version_number - right.version_number,
  );
  const originalVersion = orderedVersions[0] || null;
  const latestVersion = orderedVersions.at(-1) || null;
  const latestManualEdit =
    [...orderedVersions]
      .filter((version) => version.source_action === "manual_edit")
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .at(-1) || null;
  const latestRegeneration =
    [...orderedVersions]
      .filter((version) => version.source_action === "regenerate")
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .at(-1) || null;

  return {
    ...message,
    rationale_parts: parseMessageRationale(message.rationale),
    has_manual_edits: orderedVersions.some(
      (version) => version.source_action === "manual_edit",
    ),
    has_regenerated_variants: orderedVersions.some(
      (version) => version.source_action === "regenerate",
    ),
    version_count: orderedVersions.length,
    original_version: originalVersion,
    latest_version: latestVersion,
    edited_manually_at: latestManualEdit?.created_at || null,
    regenerated_at: latestRegeneration?.created_at || null,
  };
}

function buildActivityFeed(args: {
  draft: CampaignDraftRow;
  feedback: CampaignFeedbackRow[];
  audits: AuditLogRow[];
  actorNames: Record<string, string>;
}) {
  const items: CampaignActivityItem[] = [];

  args.audits.forEach((audit) => {
    const actorLabel = audit.actor_id
      ? args.actorNames[audit.actor_id] || audit.actor_id.slice(0, 8)
      : "system";
    const note = readNullableString(audit.meta.note);

    if (
      audit.action === "CAMPAIGN_DRAFT_GENERATED" ||
      audit.action === "CAMPAIGN_CONTENT_GENERATED"
    ) {
      const sourceTitle = readNullableString(audit.meta.sourceCampaignTitle);
      const goal = readNullableString(audit.meta.goal);
      const channels = Array.isArray(audit.meta.channels)
        ? (audit.meta.channels as string[]).join(", ")
        : readNullableString(audit.meta.channel) || "";
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "generated" as const,
        title: "Campaign generated",
        description:
          [
            goal ? `Goal: ${goal}.` : "",
            channels ? `Channels: ${channels}.` : "",
            sourceTitle ? `Duplicated from: ${sourceTitle}.` : "",
          ]
            .filter(Boolean)
            .join(" ") || "Initial proposal generated for review.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_DUPLICATED") {
      const sourceTitle = readNullableString(audit.meta.sourceCampaignTitle);
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "duplicated",
        title: "Campaign duplicated",
        description:
          sourceTitle || note
            ? `New brief created from ${sourceTitle || "an existing campaign"}.`
            : "New brief created from an existing campaign.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_APPROVED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "approved" as const,
        title: "Campaign approved",
        description: note || "Approved for internal use.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_REJECTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "rejected" as const,
        title: "Campaign rejected",
        description: note || "Rejected by admin.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_CHANGES_REQUESTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "changes_requested" as const,
        title: "Changes requested",
        description: note || "Admin requested another pass.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_MESSAGE_EDITED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "message_edited" as const,
        title: "Message edited",
        description: note || "Copy updated manually by admin.",
        message_id: audit.entity_id,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_MESSAGE_REGENERATED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "message_regenerated" as const,
        title: "Variant regenerated",
        description: note || "A new variant was generated from feedback.",
        message_id: audit.entity_id,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_ARCHIVED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "archived" as const,
        title: "Campaign archived",
        description: note || "Moved to archive.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_OWNER_ASSIGNED") {
      const ownerLabel = readNullableString(audit.meta.ownerLabel);
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "owner_assigned",
        title: "Owner updated",
        description: ownerLabel
          ? `Campaign assigned to ${ownerLabel}.`
          : "Campaign owner was cleared.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_INTERNAL_NOTE_ADDED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "note",
        title: "Internal note added",
        description: note || "Internal collaboration note recorded.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_CHECKLIST_UPDATED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "checklist_updated",
        title: "Checklist updated",
        description: note || "Editorial approval checklist updated.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_QA_REANALYZED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "qa_reanalyzed",
        title: "QA reanalyzed",
        description: note || "Automatic QA was recalculated for this campaign.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_ANALYTICS_COMPARED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "analytics_compared",
        title: "Analytics compared",
        description: note || "Current and previous ranges were compared.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_TRENDS_RECALCULATED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "trends_recalculated",
        title: "Trend summary refreshed",
        description:
          note || "Trend lines were recalculated from current metrics.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_SUFFICIENT_DATA_FLAGGED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "sufficient_data_flagged",
        title: "Sufficient data flags updated",
        description:
          note ||
          "Decision support eligibility changed for one or more variants.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_WINNER_SELECTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "winner_selected",
        title: "Winner selected",
        description: note || "A variant winner was selected.",
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_WINNER_REVERTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "winner_reverted",
        title: "Winner reverted",
        description: note || "A previous winner was reverted.",
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_MANUAL_DECISION_RECORDED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "manual_decision_recorded",
        title: "Manual decision recorded",
        description:
          note || "An admin updated the decision state for a variant.",
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_AUTOMATIC_CANDIDATE_DETECTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "automatic_candidate_detected",
        title: "Candidate detected",
        description:
          note || "A rule-based candidate was detected from current data.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_MARKED_READY_TO_PUBLISH") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "ready_to_publish",
        title: "Marked ready to publish",
        description: note || "Campaign moved into publishing readiness.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_PUBLISH_STARTED") {
      const channel = readNullableString(audit.meta.channel);
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "publish_started",
        title: "Publish started",
        description:
          note ||
          (channel
            ? `Publish job started for ${channel}.`
            : "Publish job started."),
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_PUBLISH_SUCCEEDED") {
      const mode = readNullableString(audit.meta.publishMode);
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type:
          mode === "export" || mode === "draft"
            ? "export_generated"
            : "publish_succeeded",
        title:
          mode === "export" || mode === "draft"
            ? "Export generated"
            : "Publish succeeded",
        description:
          note || "Publishing completed successfully for the selected channel.",
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_PUBLISH_FAILED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "publish_failed",
        title: "Publish failed",
        description:
          note || "Publishing failed. Review the job error before retrying.",
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_PUBLISH_PAUSED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "paused",
        title: "Publishing paused",
        description: note || "Campaign publishing was paused by admin.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_PUBLISH_RETRY_REQUESTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "retry_requested",
        title: "Publish retry requested",
        description: note || "A failed publish job was retried.",
        message_id: readNullableString(audit.meta.messageId),
      });
      return;
    }

    if (audit.action === "CAMPAIGN_METRICS_INGESTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "metrics_ingested",
        title: "Metrics ingested",
        description:
          note ||
          "Campaign metrics or funnel events were ingested for analytics.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_PERFORMANCE_UPDATED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "performance_updated",
        title: "Performance updated",
        description:
          note || "Performance summary was recalculated from current metrics.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_RECOMMENDATIONS_RECALCULATED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "insights_recalculated",
        title: "Recommendations recalculated",
        description: note || "Learning-loop recommendations were recalculated.",
        message_id: null,
      });
      return;
    }

    if (audit.action === "CAMPAIGN_ANALYTICS_EXPORTED") {
      items.push({
        id: audit.id,
        timestamp: audit.created_at,
        actor_id: audit.actor_id,
        actor_label: actorLabel,
        type: "analytics_exported",
        title: "Analytics exported",
        description: note || "Campaign analytics were exported for reporting.",
        message_id: null,
      });
    }
  });

  if (!items.some((item) => item.type === "generated")) {
    items.unshift({
      id: `generated-${args.draft.id}`,
      timestamp: args.draft.created_at,
      actor_id: args.draft.created_by,
      actor_label: args.draft.created_by
        ? args.actorNames[args.draft.created_by] ||
          args.draft.created_by.slice(0, 8)
        : "system",
      type: "generated",
      title: "Campaign generated",
      description: "Initial proposal generated for review.",
      message_id: null,
    });
  }

  if (!items.length && args.feedback.length) {
    args.feedback.forEach((feedback) => {
      const fallbackType: CampaignActivityItem["type"] =
        feedback.feedback_type === "approve"
          ? "approved"
          : feedback.feedback_type === "reject"
            ? "rejected"
            : feedback.feedback_type === "request_changes"
              ? "changes_requested"
              : feedback.feedback_type === "edit"
                ? "message_edited"
                : "message_regenerated";

      items.push({
        id: feedback.id,
        timestamp: feedback.created_at,
        actor_id: feedback.created_by,
        actor_label: feedback.created_by
          ? args.actorNames[feedback.created_by] ||
            feedback.created_by.slice(0, 8)
          : "system",
        type: fallbackType,
        title: feedback.feedback_type.replace(/_/g, " "),
        description: feedback.feedback_note || "Workflow event recorded.",
        message_id: feedback.campaign_message_id,
      });
    });
  }

  return items.sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export async function createPersistedCampaignDraft(
  params: PersistCampaignDraftParams,
): Promise<{ draft: CampaignDraftRow; messages: CampaignMessageRow[] }> {
  const { admin } = params;
  const { data: insertedDraft, error: draftError } = await admin
    .from("campaign_drafts")
    .insert({
      title: params.draft.title,
      audience: params.draft.audience,
      goal: params.draft.goal,
      channels: params.draft.channels,
      service_category: params.draft.serviceCategory,
      offer: params.draft.offer,
      cta: params.draft.cta,
      journey_trigger: params.draft.journeyTrigger ?? null,
      notes: params.draft.notes ?? null,
      rationale_summary: params.draft.rationaleSummary,
      recommended_angle: params.draft.recommendedAngle,
      brand_context: params.draft.brandContext,
      channel_plan: params.draft.channelPlan,
      kpi_suggestions: params.draft.kpiSuggestions,
      source_campaign_draft_id: params.draft.sourceCampaignDraftId ?? null,
      campaign_review_checklist: buildDefaultReviewChecklist(),
      generation_provider: params.draft.generationProvider || "mock",
      generation_provider_status: params.draft.generationProviderStatus ?? null,
      provider_metadata:
        params.draft.providerMetadata || readProviderMetadata({}),
      qa_report: normalizeCampaignQaReport({}),
      publish_status: "not_ready",
      publish_ready_at: null,
      published_at: null,
      last_publish_error: null,
      status: params.draft.status ?? "proposed",
      created_by: actorIdOrNull(params.createdBy),
    } as never)
    .select("*")
    .single();

  if (draftError || !insertedDraft) {
    throw new Error(draftError?.message || "failed to create campaign draft");
  }

  const perChannelCounter = new Map<string, number>();
  const messageRows = params.messages.map((message) => {
    const current = (perChannelCounter.get(message.channel) || 0) + 1;
    perChannelCounter.set(message.channel, current);

    return {
      campaign_draft_id: readString(
        (insertedDraft as Record<string, unknown>).id,
      ),
      channel: message.channel,
      format: message.format,
      variant_name: message.label || buildVariantName(current),
      content: serializeMessage(message),
      rationale: message.rationale,
      provider_metadata: message.providerMetadata,
      qa_report: normalizeMessageQaReport({}),
      status: params.draft.status ?? "proposed",
    };
  });

  const { data: insertedMessages, error: messagesError } = await admin
    .from("campaign_messages")
    .insert(messageRows as never)
    .select("*");

  if (messagesError) {
    await admin
      .from("campaign_drafts")
      .delete()
      .eq("id", readString((insertedDraft as Record<string, unknown>).id));
    throw new Error(
      messagesError.message || "failed to create campaign messages",
    );
  }

  const mappedMessages = (
    Array.isArray(insertedMessages) ? insertedMessages : []
  ).map((row) => mapMessageRow(row as Record<string, unknown>));

  await Promise.all(
    mappedMessages.map((message) =>
      insertMessageVersion(admin, {
        messageId: message.id,
        versionNumber: 1,
        sourceAction: "initial_generation",
        content: message.content,
        rationale: message.rationale,
        providerMetadata: message.provider_metadata,
        createdBy: params.createdBy,
      }),
    ),
  );

  const result = await reanalyzeCampaignQa(
    admin,
    readString((insertedDraft as Record<string, unknown>).id),
  );
  await recalculateCampaignVariantDecisions(
    admin,
    readString((insertedDraft as Record<string, unknown>).id),
    params.createdBy,
  );
  return result;
}

export async function listCampaignDrafts(
  admin: AdminSupabase,
  filters: ListCampaignDraftFilters = {},
): Promise<{
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin
    .from("campaign_drafts")
    .select("*", { count: "exact" })
    .order("updated_at", {
      ascending: filters.sort === "updated_asc",
    })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.publishStatus) {
    query = query.eq("publish_status", filters.publishStatus);
  }
  if (filters.audience) query = query.eq("audience", filters.audience);
  if (filters.channel) query = query.contains("channels", [filters.channel]);
  if (filters.goal) query = query.eq("goal", filters.goal);
  if (filters.owner === "unassigned") {
    query = query.is("owner_user_id", null);
  } else if (filters.owner) {
    query = query.eq("owner_user_id", filters.owner);
  }
  if (filters.q) {
    const safe = filters.q.replace(/[%(),]/g, "").trim();
    if (safe) {
      query = query.or(
        `title.ilike.%${safe}%,service_category.ilike.%${safe}%,offer.ilike.%${safe}%`,
      );
    }
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message || "failed to list campaigns");

  const drafts = (Array.isArray(data) ? data : []).map((row) =>
    mapDraftRow(row as Record<string, unknown>),
  );
  if (!drafts.length) {
    return { items: [], total: count || 0, page, pageSize };
  }

  const draftIds = drafts.map((draft) => draft.id);
  const sourceCampaignIds = drafts
    .map((draft) => draft.source_campaign_draft_id)
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  const { data: messageRows, error: messageError } = await admin
    .from("campaign_messages")
    .select("id, campaign_draft_id, updated_at")
    .in("campaign_draft_id", draftIds);

  if (messageError) {
    throw new Error(messageError.message || "failed to load campaign counts");
  }

  const messages = (Array.isArray(messageRows) ? messageRows : []).map((row) =>
    readRecord(row),
  );
  const messageIds = messages.map((row) => readString(row.id)).filter(Boolean);
  const messageToDraft = new Map<string, string>();
  messages.forEach((row) => {
    const messageId = readString(row.id);
    const draftId = readString(row.campaign_draft_id);
    if (messageId && draftId) messageToDraft.set(messageId, draftId);
  });

  let versionRows: Record<string, unknown>[] = [];
  if (messageIds.length) {
    const { data: versions, error: versionError } = await admin
      .from("campaign_message_versions")
      .select("campaign_message_id, source_action, created_at")
      .in("campaign_message_id", messageIds);

    if (versionError) {
      throw new Error(
        versionError.message || "failed to load message versions",
      );
    }
    versionRows = (Array.isArray(versions) ? versions : []).map((row) =>
      readRecord(row),
    );
  }

  const { data: feedbackRows, error: feedbackError } = await admin
    .from("campaign_feedback")
    .select("campaign_draft_id, feedback_type, created_at")
    .in("campaign_draft_id", draftIds);

  if (feedbackError) {
    throw new Error(
      feedbackError.message || "failed to load campaign feedback",
    );
  }

  const { data: publishJobRows, error: publishJobError } = await admin
    .from("campaign_publish_jobs")
    .select("campaign_draft_id, triggered_at")
    .in("campaign_draft_id", draftIds);

  if (publishJobError) {
    throw new Error(
      publishJobError.message || "failed to load publish job summaries",
    );
  }

  const actorNames = await getActorNames(admin, [
    ...drafts.map((draft) => draft.created_by || ""),
    ...drafts.map((draft) => draft.owner_user_id || ""),
  ]);

  const sourceCampaignTitleById = new Map<string, string>();
  if (sourceCampaignIds.length) {
    const { data: sourceCampaignRows, error: sourceError } = await admin
      .from("campaign_drafts")
      .select("id, title")
      .in("id", sourceCampaignIds);

    if (sourceError) {
      throw new Error(
        sourceError.message || "failed to load source campaign titles",
      );
    }

    (Array.isArray(sourceCampaignRows) ? sourceCampaignRows : []).forEach(
      (row) => {
        const value = readRecord(row);
        const id = readString(value.id);
        if (!id) return;
        sourceCampaignTitleById.set(id, readString(value.title));
      },
    );
  }

  const messageCountByDraft = new Map<string, number>();
  const lastMessageUpdateByDraft = new Map<string, string>();
  messages.forEach((row) => {
    const draftId = readString(row.campaign_draft_id);
    if (!draftId) return;
    messageCountByDraft.set(
      draftId,
      (messageCountByDraft.get(draftId) || 0) + 1,
    );
    lastMessageUpdateByDraft.set(
      draftId,
      pickLatestTimestamp(
        lastMessageUpdateByDraft.get(draftId),
        readString(row.updated_at),
      ),
    );
  });

  const manualEditByDraft = new Map<string, boolean>();
  const regenerateByDraft = new Map<string, boolean>();
  const lastVersionByDraft = new Map<string, string>();
  versionRows.forEach((row) => {
    const messageId = readString(row.campaign_message_id);
    const draftId = messageToDraft.get(messageId);
    if (!draftId) return;
    if (readString(row.source_action) === "manual_edit") {
      manualEditByDraft.set(draftId, true);
    }
    if (readString(row.source_action) === "regenerate") {
      regenerateByDraft.set(draftId, true);
    }
    lastVersionByDraft.set(
      draftId,
      pickLatestTimestamp(
        lastVersionByDraft.get(draftId),
        readString(row.created_at),
      ),
    );
  });

  const changeRequestCountByDraft = new Map<string, number>();
  const lastFeedbackByDraft = new Map<string, string>();
  (Array.isArray(feedbackRows) ? feedbackRows : []).forEach((row) => {
    const value = readRecord(row);
    const draftId = readString(value.campaign_draft_id);
    if (!draftId) return;
    if (readString(value.feedback_type) === "request_changes") {
      changeRequestCountByDraft.set(
        draftId,
        (changeRequestCountByDraft.get(draftId) || 0) + 1,
      );
    }
    lastFeedbackByDraft.set(
      draftId,
      pickLatestTimestamp(
        lastFeedbackByDraft.get(draftId),
        readString(value.created_at),
      ),
    );
  });

  const publishJobCountByDraft = new Map<string, number>();
  const lastPublishByDraft = new Map<string, string>();
  (Array.isArray(publishJobRows) ? publishJobRows : []).forEach((row) => {
    const value = readRecord(row);
    const draftId = readString(value.campaign_draft_id);
    if (!draftId) return;
    publishJobCountByDraft.set(
      draftId,
      (publishJobCountByDraft.get(draftId) || 0) + 1,
    );
    lastPublishByDraft.set(
      draftId,
      pickLatestTimestamp(
        lastPublishByDraft.get(draftId),
        readString(value.triggered_at),
      ),
    );
  });

  return {
    items: drafts.map((draft) => ({
      ...draft,
      variant_count: messageCountByDraft.get(draft.id) || 0,
      change_request_count: changeRequestCountByDraft.get(draft.id) || 0,
      has_manual_edits: manualEditByDraft.get(draft.id) || false,
      has_regenerated_variants: regenerateByDraft.get(draft.id) || false,
      last_activity_at:
        pickLatestTimestamp(
          draft.updated_at,
          lastMessageUpdateByDraft.get(draft.id),
          lastVersionByDraft.get(draft.id),
          lastFeedbackByDraft.get(draft.id),
        ) || draft.updated_at,
      owner_label: draft.owner_user_id
        ? actorNames[draft.owner_user_id] || draft.owner_user_id.slice(0, 8)
        : null,
      created_by_label: draft.created_by
        ? actorNames[draft.created_by] || draft.created_by.slice(0, 8)
        : null,
      source_campaign_title: draft.source_campaign_draft_id
        ? sourceCampaignTitleById.get(draft.source_campaign_draft_id) || null
        : null,
      publish_job_count: publishJobCountByDraft.get(draft.id) || 0,
      last_publish_at: lastPublishByDraft.get(draft.id) || null,
    })),
    total: count || 0,
    page,
    pageSize,
  };
}

export async function getCampaignDetail(
  admin: AdminSupabase,
  campaignId: string,
): Promise<CampaignDetail | null> {
  const { data: draftRow, error: draftError } = await admin
    .from("campaign_drafts")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (draftError) {
    throw new Error(draftError.message || "failed to load campaign");
  }
  if (!draftRow) return null;

  const draft = mapDraftRow(draftRow as Record<string, unknown>);

  const { data: messageRows, error: messageError } = await admin
    .from("campaign_messages")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("channel", { ascending: true })
    .order("created_at", { ascending: true });

  if (messageError) {
    throw new Error(messageError.message || "failed to load campaign messages");
  }

  const baseMessages = (Array.isArray(messageRows) ? messageRows : []).map(
    (row) => mapMessageRow(row as Record<string, unknown>),
  );
  const messageIds = baseMessages.map((message) => message.id);

  const { data: feedbackRows, error: feedbackError } = await admin
    .from("campaign_feedback")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("created_at", { ascending: false });

  if (feedbackError) {
    throw new Error(
      feedbackError.message || "failed to load campaign feedback",
    );
  }

  const { data: internalNoteRows, error: internalNotesError } = await admin
    .from("campaign_internal_notes")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("created_at", { ascending: false });

  if (internalNotesError) {
    throw new Error(
      internalNotesError.message || "failed to load internal campaign notes",
    );
  }

  const { data: publishJobRows, error: publishJobsError } = await admin
    .from("campaign_publish_jobs")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("triggered_at", { ascending: false });

  if (publishJobsError) {
    throw new Error(
      publishJobsError.message || "failed to load campaign publish jobs",
    );
  }

  const { data: variantDecisionRows, error: variantDecisionError } = await admin
    .from("campaign_variant_decisions")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("updated_at", { ascending: false });

  if (variantDecisionError) {
    throw new Error(
      variantDecisionError.message || "failed to load variant decisions",
    );
  }

  let versionRows: CampaignMessageVersionRow[] = [];
  if (messageIds.length) {
    const { data: versions, error: versionError } = await admin
      .from("campaign_message_versions")
      .select("*")
      .in("campaign_message_id", messageIds)
      .order("version_number", { ascending: true });

    if (versionError) {
      throw new Error(
        versionError.message || "failed to load message versions",
      );
    }
    versionRows = (Array.isArray(versions) ? versions : []).map((row) =>
      mapVersionRow(row as Record<string, unknown>),
    );
  }

  const entityIds = [campaignId, ...messageIds];
  const { data: auditRows, error: auditError } = await admin
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, meta, created_at")
    .in("entity_id", entityIds)
    .order("created_at", { ascending: true });

  if (auditError) {
    throw new Error(auditError.message || "failed to load audit log");
  }

  const audits = (Array.isArray(auditRows) ? auditRows : []).map((row) =>
    mapAuditRow(row as Record<string, unknown>),
  );

  const actorNames = await getActorNames(admin, [
    draft.created_by || "",
    draft.owner_user_id || "",
    ...((Array.isArray(feedbackRows) ? feedbackRows : []).map((row) =>
      readString((row as Record<string, unknown>).created_by),
    ) || []),
    ...versionRows.map((row) => row.created_by || ""),
    ...audits.map((row) => row.actor_id || ""),
    ...((Array.isArray(publishJobRows) ? publishJobRows : []).map((row) =>
      readString((row as Record<string, unknown>).triggered_by),
    ) || []),
    ...((Array.isArray(internalNoteRows) ? internalNoteRows : []).map((row) =>
      readString((row as Record<string, unknown>).created_by),
    ) || []),
  ]);

  const versionsByMessage = new Map<string, CampaignMessageVersionRow[]>();
  versionRows.forEach((version) => {
    const current = versionsByMessage.get(version.campaign_message_id) || [];
    current.push(version);
    versionsByMessage.set(version.campaign_message_id, current);
  });

  const messages = baseMessages.map((message) =>
    mapMessageView(message, versionsByMessage.get(message.id) || []),
  );
  const feedback = (Array.isArray(feedbackRows) ? feedbackRows : []).map(
    (row) => mapFeedbackRow(row as Record<string, unknown>),
  );
  const internalNotes = (
    Array.isArray(internalNoteRows) ? internalNoteRows : []
  ).map((row) => mapInternalNoteRow(row as Record<string, unknown>));
  const publishJobs = (Array.isArray(publishJobRows) ? publishJobRows : []).map(
    (row) => mapPublishJobRow(row as Record<string, unknown>),
  );
  const variantDecisions = (
    Array.isArray(variantDecisionRows) ? variantDecisionRows : []
  ).map((row) => mapVariantDecisionRow(row as Record<string, unknown>));

  let sourceCampaign: Pick<CampaignDraftRow, "id" | "title"> | null = null;
  if (draft.source_campaign_draft_id) {
    const { data: sourceRow } = await admin
      .from("campaign_drafts")
      .select("id, title")
      .eq("id", draft.source_campaign_draft_id)
      .maybeSingle();

    if (sourceRow) {
      const value = readRecord(sourceRow);
      sourceCampaign = {
        id: readString(value.id),
        title: readString(value.title),
      };
    }
  }

  return {
    draft,
    messages,
    variantDecisions,
    feedback,
    versions: versionRows,
    internalNotes,
    publishJobs,
    activityFeed: buildActivityFeed({
      draft,
      feedback,
      audits,
      actorNames,
    }),
    actorNames,
    reviewerOptions: await listReviewerOptions(admin),
    sourceCampaign,
  };
}

export async function updateCampaignWorkflowStatus(
  admin: AdminSupabase,
  input: {
    campaignId: string;
    status: CampaignWorkflowStatus;
    feedbackType: CampaignFeedbackType;
    feedbackNote?: string | null;
    createdBy?: string | null;
  },
) {
  await setCampaignStatus(admin, input.campaignId, input.status);
  await recordFeedback(admin, {
    campaignDraftId: input.campaignId,
    feedbackType: input.feedbackType,
    feedbackNote: input.feedbackNote,
    createdBy: input.createdBy,
  });
}

export async function assignCampaignOwner(
  input: AssignCampaignOwnerParams,
): Promise<CampaignDraftRow> {
  const { data, error } = await input.admin
    .from("campaign_drafts")
    .update({
      owner_user_id: actorIdOrNull(input.ownerUserId),
      owner_assigned_at: input.ownerUserId ? new Date().toISOString() : null,
    } as never)
    .eq("id", input.campaignId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to assign campaign owner");
  }

  return mapDraftRow(data as Record<string, unknown>);
}

export async function updateCampaignReviewChecklist(input: {
  admin: AdminSupabase;
  campaignId: string;
  checklist: CampaignReviewChecklist;
}): Promise<CampaignDraftRow> {
  const { data, error } = await input.admin
    .from("campaign_drafts")
    .update({
      campaign_review_checklist: normalizeReviewChecklist(input.checklist),
    } as never)
    .eq("id", input.campaignId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to update campaign checklist");
  }

  return mapDraftRow(data as Record<string, unknown>);
}

export async function listCampaignInternalNotes(
  admin: AdminSupabase,
  campaignId: string,
): Promise<CampaignInternalNoteRow[]> {
  const { data, error } = await admin
    .from("campaign_internal_notes")
    .select("*")
    .eq("campaign_draft_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "failed to list internal notes");
  }

  return (Array.isArray(data) ? data : []).map((row) =>
    mapInternalNoteRow(row as Record<string, unknown>),
  );
}

export async function createCampaignInternalNote(
  input: CreateCampaignInternalNoteParams,
): Promise<CampaignInternalNoteRow> {
  const { data, error } = await input.admin
    .from("campaign_internal_notes")
    .insert({
      campaign_draft_id: input.campaignId,
      note: input.note,
      created_by: actorIdOrNull(input.createdBy),
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "failed to create internal note");
  }

  return mapInternalNoteRow(data as Record<string, unknown>);
}

async function getCampaignMessageWithDraft(
  admin: AdminSupabase,
  messageId: string,
): Promise<{ message: CampaignMessageRow; draft: CampaignDraftRow }> {
  const { data: messageRow, error: messageError } = await admin
    .from("campaign_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  if (messageError || !messageRow) {
    throw new Error(messageError?.message || "campaign message not found");
  }

  const message = mapMessageRow(messageRow as Record<string, unknown>);
  const { data: draftRow, error: draftError } = await admin
    .from("campaign_drafts")
    .select("*")
    .eq("id", message.campaign_draft_id)
    .maybeSingle();

  if (draftError || !draftRow) {
    throw new Error(draftError?.message || "campaign draft not found");
  }

  return {
    message,
    draft: mapDraftRow(draftRow as Record<string, unknown>),
  };
}

export async function editCampaignMessage(
  input: EditCampaignMessageParams,
): Promise<{ draftId: string; message: CampaignMessageRow }> {
  const { admin } = input;
  const { message, draft } = await getCampaignMessageWithDraft(
    admin,
    input.messageId,
  );
  const nextStatus = reopenStatusFrom(draft.status);
  const nextMessageStatus = nextStatus === "draft" ? "draft" : "proposed";
  const nextVersion = await getNextMessageVersionNumber(admin, input.messageId);

  const content: CampaignMessageContent = {
    headline: input.headline?.trim() || message.content.headline,
    body: input.body?.trim() || message.content.body,
    cta: input.cta?.trim() || message.content.cta,
  };
  const rationale = buildEditRationale({
    current: message.rationale,
    channel: message.channel,
    cta: content.cta,
    note: input.rationaleNote,
  });

  const { data: updatedMessageRow, error: updateError } = await admin
    .from("campaign_messages")
    .update({
      content,
      rationale,
      status: nextMessageStatus,
    } as never)
    .eq("id", input.messageId)
    .select("*")
    .single();

  if (updateError || !updatedMessageRow) {
    throw new Error(
      updateError?.message || "failed to update campaign message",
    );
  }

  await setCampaignStatus(admin, draft.id, nextStatus);

  await insertMessageVersion(admin, {
    messageId: input.messageId,
    versionNumber: nextVersion,
    sourceAction: "manual_edit",
    content,
    rationale,
    providerMetadata: message.provider_metadata,
    createdBy: input.createdBy,
  });
  await recordFeedback(admin, {
    campaignDraftId: draft.id,
    campaignMessageId: input.messageId,
    feedbackType: "edit",
    feedbackNote: input.rationaleNote || "Manual edit",
    createdBy: input.createdBy,
  });
  const qaResult = await reanalyzeCampaignQa(admin, draft.id);
  await recalculateCampaignVariantDecisions(admin, draft.id, input.createdBy);
  const refreshedMessage =
    qaResult.messages.find((item) => item.id === input.messageId) ||
    mapMessageRow(updatedMessageRow as Record<string, unknown>);

  return {
    draftId: draft.id,
    message: refreshedMessage,
  };
}

export async function regenerateCampaignMessage(
  input: RegenerateCampaignMessageParams & {
    generator: (
      payload: ContentGenerationInput,
      context?: {
        previousMessage?: CampaignMessageContent | null;
        previousRationale?: string | null;
        feedbackNote?: string | null;
      },
    ) => Promise<GeneratedContentProposal>;
  },
): Promise<{ draftId: string; message: CampaignMessageRow }> {
  const { admin } = input;
  const { message, draft } = await getCampaignMessageWithDraft(
    admin,
    input.messageId,
  );
  const nextStatus = reopenStatusFrom(draft.status);
  const nextMessageStatus = nextStatus === "draft" ? "draft" : "proposed";
  const nextVersion = await getNextMessageVersionNumber(admin, input.messageId);
  const generation = await input.generator(
    {
      title: draft.title,
      audience: draft.audience,
      goal: draft.goal,
      channel: message.channel,
      format: message.format,
      serviceCategory: draft.service_category,
      offer: draft.offer,
      cta: draft.cta,
      tonePreference: "",
      notes: [
        draft.notes,
        `Previous headline: ${message.content.headline}`,
        `Previous body: ${message.content.body}`,
        input.feedbackNote ? `Feedback note: ${input.feedbackNote}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      previousMessage: message.content,
      previousRationale: message.rationale,
      feedbackNote: input.feedbackNote,
    },
  );

  const nextVariant =
    generation.variants[(nextVersion - 1) % generation.variants.length] ||
    generation.variants[0];

  if (!nextVariant) {
    throw new Error("failed to regenerate message variant");
  }

  const content = serializeMessage(nextVariant);
  const parsedRationale = parseMessageRationale(nextVariant.rationale);
  const rationale = serializeMessageRationale({
    angle: parsedRationale.angle || nextVariant.angle,
    audienceIntent:
      parsedRationale.audienceIntent ||
      "Refresh the message while keeping the intent aligned with the campaign goal.",
    whyChannel:
      parsedRationale.whyChannel ||
      `${labelChannel(message.channel)} remains the right place for this variant.`,
    whyCta:
      parsedRationale.whyCta ||
      `The CTA "${content.cta}" keeps the next step concrete and easy to evaluate.`,
    note:
      input.feedbackNote?.trim() || "Variant regenerated from admin feedback.",
    summary: parsedRationale.summary,
  });

  const { data: updatedMessageRow, error: updateError } = await admin
    .from("campaign_messages")
    .update({
      variant_name: `Regenerated ${nextVersion}`,
      content,
      rationale,
      provider_metadata: toProviderMetadata(generation.provider),
      status: nextMessageStatus,
    } as never)
    .eq("id", input.messageId)
    .select("*")
    .single();

  if (updateError || !updatedMessageRow) {
    throw new Error(
      updateError?.message || "failed to regenerate campaign message",
    );
  }

  await admin
    .from("campaign_drafts")
    .update({
      generation_provider: generation.provider.activeProvider,
      generation_provider_status: summarizeProviderStatus(generation.provider),
      provider_metadata: toProviderMetadata(generation.provider),
    } as never)
    .eq("id", draft.id);

  await setCampaignStatus(admin, draft.id, nextStatus);

  await insertMessageVersion(admin, {
    messageId: input.messageId,
    versionNumber: nextVersion,
    sourceAction: "regenerate",
    content,
    rationale,
    providerMetadata: toProviderMetadata(generation.provider),
    createdBy: input.createdBy,
  });
  await recordFeedback(admin, {
    campaignDraftId: draft.id,
    campaignMessageId: input.messageId,
    feedbackType: "regenerate",
    feedbackNote: input.feedbackNote || "Regenerated variant",
    createdBy: input.createdBy,
  });
  const qaResult = await reanalyzeCampaignQa(admin, draft.id);
  await recalculateCampaignVariantDecisions(admin, draft.id, input.createdBy);
  const refreshedMessage =
    qaResult.messages.find((item) => item.id === input.messageId) ||
    mapMessageRow(updatedMessageRow as Record<string, unknown>);

  return {
    draftId: draft.id,
    message: refreshedMessage,
  };
}

export async function batchUpdateCampaigns(
  admin: AdminSupabase,
  input: {
    campaignIds: string[];
    action: BatchCampaignAction;
    note?: string | null;
    createdBy?: string | null;
  },
) {
  const campaignIds = Array.from(
    new Set(
      input.campaignIds.filter((value) => typeof value === "string" && value),
    ),
  );

  for (const campaignId of campaignIds) {
    if (input.action === "approve") {
      await updateCampaignWorkflowStatus(admin, {
        campaignId,
        status: "approved",
        feedbackType: "approve",
        feedbackNote: input.note,
        createdBy: input.createdBy,
      });
      continue;
    }

    if (input.action === "reject") {
      await updateCampaignWorkflowStatus(admin, {
        campaignId,
        status: "rejected",
        feedbackType: "reject",
        feedbackNote: input.note,
        createdBy: input.createdBy,
      });
      continue;
    }

    await setCampaignStatus(admin, campaignId, "archived");
  }

  return campaignIds;
}

export function isFeedbackType(value: string): value is CampaignFeedbackType {
  return CAMPAIGN_FEEDBACK_TYPES.includes(value as CampaignFeedbackType);
}

export function buildPersistInputFromCampaignProposal(args: {
  createdBy: string | null;
  input: CampaignGenerationInput;
  proposal: GeneratedCampaignProposal;
  admin: AdminSupabase;
}): PersistCampaignDraftParams {
  return {
    admin: args.admin,
    createdBy: args.createdBy,
    draft: {
      title: args.proposal.title,
      audience: args.input.audience,
      goal: args.input.goal,
      channels: args.input.channels,
      serviceCategory: args.input.serviceCategory,
      offer: args.input.offer,
      cta: args.input.cta,
      journeyTrigger: args.input.journeyTrigger,
      notes: mergeBriefNotes(args.input.notes, args.input.tonePreference),
      rationaleSummary: args.proposal.rationaleSummary,
      recommendedAngle: args.proposal.recommendedAngle,
      brandContext: args.proposal.brandContext,
      channelPlan: args.proposal.channelPlan,
      kpiSuggestions: args.proposal.kpiSuggestions,
      sourceCampaignDraftId: args.input.sourceCampaignDraftId ?? null,
      generationProvider: args.proposal.provider.activeProvider,
      generationProviderStatus: summarizeProviderStatus(args.proposal.provider),
      providerMetadata: toProviderMetadata(args.proposal.provider),
      status: "proposed",
    },
    messages: args.proposal.messageSuggestions,
  };
}

export function buildPersistInputFromContentProposal(args: {
  createdBy: string | null;
  input: ContentGenerationInput;
  proposal: GeneratedContentProposal;
  admin: AdminSupabase;
}): PersistCampaignDraftParams {
  return {
    admin: args.admin,
    createdBy: args.createdBy,
    draft: {
      title: args.proposal.title,
      audience: args.input.audience,
      goal: args.input.goal,
      channels: [args.input.channel],
      serviceCategory: args.input.serviceCategory,
      offer: args.input.offer,
      cta: args.input.cta,
      journeyTrigger: null,
      notes: mergeBriefNotes(args.input.notes, args.input.tonePreference),
      rationaleSummary: args.proposal.rationaleSummary,
      recommendedAngle: args.proposal.recommendedAngle,
      brandContext: args.proposal.brandContext,
      channelPlan: args.proposal.channelPlan,
      kpiSuggestions: args.proposal.kpiSuggestions,
      sourceCampaignDraftId: args.input.sourceCampaignDraftId ?? null,
      generationProvider: args.proposal.provider.activeProvider,
      generationProviderStatus: summarizeProviderStatus(args.proposal.provider),
      providerMetadata: toProviderMetadata(args.proposal.provider),
      status: "proposed",
    },
    messages: args.proposal.variants,
  };
}
