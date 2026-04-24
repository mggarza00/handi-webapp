import {
  audienceTypes,
  campaignGoals,
  channelTypes,
  type AudienceType,
  type BrandContext,
  type CampaignGoal,
  type ChannelType,
  type ContentFormat,
  type JourneyStep,
  type KpiSuggestion,
  type ProviderMetadata,
} from "@/lib/ai/schemas";

export const CAMPAIGN_WORKFLOW_STATUSES = [
  "draft",
  "proposed",
  "changes_requested",
  "approved",
  "rejected",
  "archived",
] as const;

export const CAMPAIGN_FEEDBACK_TYPES = [
  "approve",
  "reject",
  "request_changes",
  "edit",
  "regenerate",
] as const;

export const CAMPAIGN_VERSION_ACTIONS = [
  "initial_generation",
  "manual_edit",
  "regenerate",
] as const;
export const CAMPAIGN_MESSAGE_PLACEMENT_SOURCES = [
  "inherited",
  "ai_generated",
  "manual_override",
] as const;

export type CampaignWorkflowStatus =
  (typeof CAMPAIGN_WORKFLOW_STATUSES)[number];
export type CampaignFeedbackType = (typeof CAMPAIGN_FEEDBACK_TYPES)[number];
export type CampaignVersionAction = (typeof CAMPAIGN_VERSION_ACTIONS)[number];
export type CampaignMessagePlacementSource =
  (typeof CAMPAIGN_MESSAGE_PLACEMENT_SOURCES)[number];
export type CampaignSortOrder = "updated_desc" | "updated_asc";

export const CAMPAIGN_PUBLISH_STATUSES = [
  "not_ready",
  "ready_to_publish",
  "publishing",
  "published",
  "publish_failed",
  "paused",
  "archived",
] as const;

export const CAMPAIGN_PUBLISH_MODES = ["live", "draft", "export"] as const;
export const CAMPAIGN_PUBLISH_QUEUE_STATUSES = [
  "queued",
  "scheduled",
  "ready",
  "running",
  "completed",
  "failed",
  "paused",
  "cancelled",
] as const;
export const CAMPAIGN_PUBLISH_QUEUE_ERROR_TYPES = [
  "recoverable_transient",
  "recoverable_rate_limited",
  "configuration_error",
  "readiness_error",
  "approval_error",
  "unsupported_channel",
  "targeting_error",
  "expired_window",
  "lock_conflict",
  "unknown_error",
] as const;
export const CAMPAIGN_PUBLISH_QUEUE_HEALTH_STATUSES = [
  "healthy",
  "attention",
  "degraded",
] as const;
export const CAMPAIGN_PUBLISH_QUEUE_DEFERRED_REASONS = [
  "channel_throttled",
  "concurrency_blocked",
  "retry_deferred",
  "lock_conflict",
] as const;

export type CampaignPublishStatus = (typeof CAMPAIGN_PUBLISH_STATUSES)[number];
export type CampaignPublishMode = (typeof CAMPAIGN_PUBLISH_MODES)[number];
export type CampaignPublishQueueStatus =
  (typeof CAMPAIGN_PUBLISH_QUEUE_STATUSES)[number];
export type CampaignPublishQueueErrorType =
  (typeof CAMPAIGN_PUBLISH_QUEUE_ERROR_TYPES)[number];
export type CampaignPublishQueueHealthStatus =
  (typeof CAMPAIGN_PUBLISH_QUEUE_HEALTH_STATUSES)[number];
export type CampaignPublishQueueDeferredReason =
  (typeof CAMPAIGN_PUBLISH_QUEUE_DEFERRED_REASONS)[number];
export type PublishChannel = ChannelType | "google";

export const CAMPAIGN_QA_STATUSES = [
  "ready_for_review",
  "needs_attention",
  "high_risk",
] as const;

export const REVIEWER_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const CAMPAIGN_VARIANT_DECISION_STATUSES = [
  "candidate",
  "winner",
  "loser",
  "insufficient_data",
  "manual_only",
  "archived",
] as const;

export const CAMPAIGN_DECISION_ELIGIBILITIES = [
  "eligible",
  "limited",
  "manual_only",
  "not_supported",
] as const;

export const CAMPAIGN_DECISION_SOURCES = ["manual", "rule_based"] as const;

export type CampaignQaStatus = (typeof CAMPAIGN_QA_STATUSES)[number];
export type ReviewerPriority = (typeof REVIEWER_PRIORITIES)[number];
export type CampaignVariantDecisionStatus =
  (typeof CAMPAIGN_VARIANT_DECISION_STATUSES)[number];
export type CampaignDecisionEligibility =
  (typeof CAMPAIGN_DECISION_ELIGIBILITIES)[number];
export type CampaignDecisionSource = (typeof CAMPAIGN_DECISION_SOURCES)[number];

export const REVIEW_CHECKLIST_FIELDS = [
  "brandAligned",
  "messageClear",
  "ctaCorrect",
  "audienceCorrect",
  "channelCorrect",
  "claimsSafe",
  "readyForApproval",
] as const;

export type CampaignReviewChecklistKey =
  (typeof REVIEW_CHECKLIST_FIELDS)[number];

export type CampaignReviewChecklist = Record<
  CampaignReviewChecklistKey,
  boolean
>;

export type ReviewerOption = {
  id: string;
  label: string;
  email: string | null;
};

export type CampaignMessageContent = {
  headline: string;
  body: string;
  cta: string;
};

export type StructuredMessageRationale = {
  angle: string;
  audienceIntent: string;
  whyChannel: string;
  whyCta: string;
  note: string | null;
  summary: string;
};

export type CampaignQaReport = {
  qa_status: CampaignQaStatus;
  reviewer_priority: ReviewerPriority;
  overall_score: number;
  summary: string;
  warnings: string[];
  suggestions: string[];
  analyzed_at: string | null;
  ready_for_review: boolean;
};

export type MessageQaReport = {
  qa_status: CampaignQaStatus;
  reviewer_priority: ReviewerPriority;
  overall_score: number;
  brand_fit_score: number;
  clarity_score: number;
  cta_score: number;
  channel_fit_score: number;
  risk_score: number;
  warnings: string[];
  suggestions: string[];
  detected_issues: string[];
  analyzed_at: string | null;
  ready_for_review: boolean;
};

export type CampaignDraftRow = {
  id: string;
  title: string;
  audience: AudienceType;
  goal: CampaignGoal;
  channels: ChannelType[];
  service_category: string;
  offer: string;
  cta: string;
  journey_trigger: string | null;
  notes: string | null;
  rationale_summary: string;
  recommended_angle: string;
  brand_context: BrandContext;
  channel_plan: JourneyStep[];
  kpi_suggestions: KpiSuggestion[];
  owner_user_id: string | null;
  owner_assigned_at: string | null;
  source_campaign_draft_id: string | null;
  campaign_review_checklist: CampaignReviewChecklist;
  generation_provider: string;
  generation_provider_status: string | null;
  provider_metadata: ProviderMetadata;
  qa_report: CampaignQaReport;
  publish_status: CampaignPublishStatus;
  publish_ready_at: string | null;
  published_at: string | null;
  last_publish_error: string | null;
  status: CampaignWorkflowStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignMessageRow = {
  id: string;
  campaign_draft_id: string;
  channel: ChannelType;
  format: ContentFormat;
  variant_name: string;
  content: CampaignMessageContent;
  rationale: string;
  provider_metadata: ProviderMetadata;
  qa_report: MessageQaReport;
  status: CampaignWorkflowStatus;
  created_at: string;
  updated_at: string;
};

export type CampaignMessagePlacementRow = {
  id: string;
  campaign_draft_id: string;
  campaign_message_id: string;
  channel: CampaignMessageRow["channel"];
  placement_id: string;
  content: CampaignMessageContent;
  rationale: string;
  provider_metadata: ProviderMetadata;
  qa_report: MessageQaReport;
  status: CampaignWorkflowStatus;
  source: CampaignMessagePlacementSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignFeedbackRow = {
  id: string;
  campaign_draft_id: string;
  campaign_message_id: string | null;
  feedback_type: CampaignFeedbackType;
  feedback_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type CampaignInternalNoteRow = {
  id: string;
  campaign_draft_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type CampaignPublishJobRow = {
  id: string;
  campaign_draft_id: string;
  channel: PublishChannel;
  message_id: string | null;
  publish_status: CampaignPublishStatus;
  publish_mode: CampaignPublishMode;
  queue_status: CampaignPublishQueueStatus;
  provider_name: string;
  provider_response_summary: string;
  payload: Record<string, unknown>;
  external_reference_id: string | null;
  error_message: string | null;
  error_type: CampaignPublishQueueErrorType | null;
  deferred_reason: CampaignPublishQueueDeferredReason | null;
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
  triggered_by: string | null;
  triggered_at: string;
  completed_at: string | null;
};

export type CampaignMessageVersionRow = {
  id: string;
  campaign_message_id: string;
  version_number: number;
  source_action: CampaignVersionAction;
  content: CampaignMessageContent;
  rationale: string;
  provider_metadata: ProviderMetadata;
  created_by: string | null;
  created_at: string;
};

export type CampaignVariantDecisionRow = {
  id: string;
  campaign_draft_id: string;
  campaign_message_id: string;
  channel: PublishChannel;
  decision_status: CampaignVariantDecisionStatus;
  decision_source: CampaignDecisionSource;
  decision_eligibility: CampaignDecisionEligibility;
  sufficient_data: boolean;
  sufficient_data_reason: string | null;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CampaignMessageView = CampaignMessageRow & {
  rationale_parts: StructuredMessageRationale;
  has_manual_edits: boolean;
  has_regenerated_variants: boolean;
  version_count: number;
  original_version: CampaignMessageVersionRow | null;
  latest_version: CampaignMessageVersionRow | null;
  edited_manually_at: string | null;
  regenerated_at: string | null;
};

export type CampaignMessagePlacementView = CampaignMessagePlacementRow & {
  rationale_parts: StructuredMessageRationale;
};

export type CampaignListItem = CampaignDraftRow & {
  variant_count: number;
  change_request_count: number;
  has_manual_edits: boolean;
  has_regenerated_variants: boolean;
  last_activity_at: string;
  owner_label: string | null;
  created_by_label: string | null;
  source_campaign_title: string | null;
  publish_job_count: number;
  last_publish_at: string | null;
  queue_pending_count: number;
  queue_running_count: number;
  queue_failed_count: number;
  queue_retry_pending_count: number;
  queue_health_status: CampaignPublishQueueHealthStatus;
};

export type CampaignActivityType =
  | "generated"
  | "duplicated"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "creative_asset_job_created"
  | "creative_asset_generated"
  | "creative_asset_regenerated"
  | "creative_asset_approved"
  | "creative_asset_rejected"
  | "creative_asset_changes_requested"
  | "creative_asset_version_created"
  | "creative_asset_adaptation_created"
  | "creative_asset_adaptation_regenerated"
  | "creative_asset_adaptation_approved"
  | "creative_asset_adaptation_rejected"
  | "creative_asset_adaptation_changes_requested"
  | "creative_bundle_resolved"
  | "creative_bundle_manual_override"
  | "creative_bundle_cleared"
  | "creative_bundle_missing_detected"
  | "creative_bundle_ready"
  | "visual_readiness_evaluated"
  | "visual_readiness_blocked"
  | "creative_export_package_generated"
  | "creative_export_package_downloaded"
  | "creative_bundle_download_generated"
  | "creative_bundle_downloaded"
  | "creative_bundle_download_blocked"
  | "creative_bundle_download_warning_emitted"
  | "creative_bundle_channel_ready"
  | "creative_bundle_channel_missing"
  | "placement_readiness_evaluated"
  | "placement_missing_detected"
  | "placement_export_generated"
  | "placement_bundle_downloaded"
  | "placement_copy_generated"
  | "placement_copy_approved"
  | "placement_copy_rejected"
  | "placement_copy_manual_override"
  | "placement_copy_inherited"
  | "placement_copy_used_in_export"
  | "paid_handoff_generated"
  | "paid_handoff_exported"
  | "paid_placement_ready"
  | "paid_placement_warning_emitted"
  | "paid_placement_missing_detected"
  | "paid_draft_generated"
  | "paid_draft_downloaded"
  | "paid_draft_warning_emitted"
  | "paid_draft_blocked"
  | "paid_draft_included_in_bundle"
  | "analytics_contracts_updated"
  | "attribution_mapping_prepared"
  | "message_edited"
  | "message_regenerated"
  | "archived"
  | "owner_assigned"
  | "checklist_updated"
  | "qa_reanalyzed"
  | "ready_to_publish"
  | "publish_started"
  | "publish_succeeded"
  | "publish_failed"
  | "paused"
  | "retry_requested"
  | "export_generated"
  | "publish_scheduled"
  | "publish_unscheduled"
  | "queue_job_ready"
  | "queue_job_started"
  | "queue_job_completed"
  | "queue_job_failed"
  | "retry_scheduled"
  | "retry_exhausted"
  | "queue_job_cancelled"
  | "queue_job_run_manually"
  | "queue_run_triggered"
  | "queue_run_completed"
  | "channel_throttled"
  | "concurrency_blocked"
  | "retry_deferred"
  | "error_classified"
  | "cron_run_due_called"
  | "metrics_ingested"
  | "analytics_compared"
  | "trends_recalculated"
  | "sufficient_data_flagged"
  | "winner_selected"
  | "winner_reverted"
  | "manual_decision_recorded"
  | "automatic_candidate_detected"
  | "performance_updated"
  | "insights_recalculated"
  | "analytics_exported"
  | "note";

export type CampaignActivityItem = {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_label: string;
  type: CampaignActivityType;
  title: string;
  description: string;
  message_id: string | null;
};

type SerializeRationaleInput = Omit<
  StructuredMessageRationale,
  "summary" | "note"
> & {
  note?: string | null;
  summary?: string;
};

const rationaleLabels = {
  angle: "Angle",
  audienceIntent: "Audience intent",
  whyChannel: "Why this channel",
  whyCta: "Why this CTA",
  note: "Note",
} as const;

export function isWorkflowStatus(
  value: string,
): value is CampaignWorkflowStatus {
  return CAMPAIGN_WORKFLOW_STATUSES.includes(value as CampaignWorkflowStatus);
}

export function isPublishStatus(value: string): value is CampaignPublishStatus {
  return CAMPAIGN_PUBLISH_STATUSES.includes(value as CampaignPublishStatus);
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildDefaultCampaignQaReport(): CampaignQaReport {
  return {
    qa_status: "needs_attention",
    reviewer_priority: "medium",
    overall_score: 0,
    summary: "QA analysis not available yet.",
    warnings: [],
    suggestions: [],
    analyzed_at: null,
    ready_for_review: false,
  };
}

export function buildDefaultMessageQaReport(): MessageQaReport {
  return {
    qa_status: "needs_attention",
    reviewer_priority: "medium",
    overall_score: 0,
    brand_fit_score: 0,
    clarity_score: 0,
    cta_score: 0,
    channel_fit_score: 0,
    risk_score: 100,
    warnings: [],
    suggestions: [],
    detected_issues: [],
    analyzed_at: null,
    ready_for_review: false,
  };
}

export function normalizePublishStatus(value: unknown): CampaignPublishStatus {
  return typeof value === "string" && isPublishStatus(value)
    ? value
    : "not_ready";
}

export function isPublishQueueStatus(
  value: string,
): value is CampaignPublishQueueStatus {
  return CAMPAIGN_PUBLISH_QUEUE_STATUSES.includes(
    value as CampaignPublishQueueStatus,
  );
}

export function normalizePublishQueueStatus(
  value: unknown,
): CampaignPublishQueueStatus {
  return typeof value === "string" && isPublishQueueStatus(value)
    ? value
    : "completed";
}

export function isPublishQueueErrorType(
  value: string,
): value is CampaignPublishQueueErrorType {
  return CAMPAIGN_PUBLISH_QUEUE_ERROR_TYPES.includes(
    value as CampaignPublishQueueErrorType,
  );
}

export function normalizePublishQueueErrorType(
  value: unknown,
): CampaignPublishQueueErrorType | null {
  return typeof value === "string" && isPublishQueueErrorType(value)
    ? value
    : null;
}

export function isPublishQueueDeferredReason(
  value: string,
): value is CampaignPublishQueueDeferredReason {
  return CAMPAIGN_PUBLISH_QUEUE_DEFERRED_REASONS.includes(
    value as CampaignPublishQueueDeferredReason,
  );
}

export function normalizePublishQueueDeferredReason(
  value: unknown,
): CampaignPublishQueueDeferredReason | null {
  return typeof value === "string" && isPublishQueueDeferredReason(value)
    ? value
    : null;
}

export function normalizeCampaignQaReport(value: unknown): CampaignQaReport {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof CampaignQaReport, unknown>>)
      : {};
  const fallback = buildDefaultCampaignQaReport();
  const qaStatus =
    typeof source.qa_status === "string" &&
    CAMPAIGN_QA_STATUSES.includes(source.qa_status as CampaignQaStatus)
      ? (source.qa_status as CampaignQaStatus)
      : fallback.qa_status;
  const reviewerPriority =
    typeof source.reviewer_priority === "string" &&
    REVIEWER_PRIORITIES.includes(source.reviewer_priority as ReviewerPriority)
      ? (source.reviewer_priority as ReviewerPriority)
      : fallback.reviewer_priority;

  return {
    qa_status: qaStatus,
    reviewer_priority: reviewerPriority,
    overall_score:
      typeof source.overall_score === "number"
        ? clampScore(source.overall_score)
        : fallback.overall_score,
    summary:
      typeof source.summary === "string" ? source.summary : fallback.summary,
    warnings: Array.isArray(source.warnings)
      ? source.warnings.filter(
          (item): item is string => typeof item === "string",
        )
      : fallback.warnings,
    suggestions: Array.isArray(source.suggestions)
      ? source.suggestions.filter(
          (item): item is string => typeof item === "string",
        )
      : fallback.suggestions,
    analyzed_at:
      typeof source.analyzed_at === "string" ? source.analyzed_at : null,
    ready_for_review:
      typeof source.ready_for_review === "boolean"
        ? source.ready_for_review
        : fallback.ready_for_review,
  };
}

export function normalizeMessageQaReport(value: unknown): MessageQaReport {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof MessageQaReport, unknown>>)
      : {};
  const fallback = buildDefaultMessageQaReport();
  const qaStatus =
    typeof source.qa_status === "string" &&
    CAMPAIGN_QA_STATUSES.includes(source.qa_status as CampaignQaStatus)
      ? (source.qa_status as CampaignQaStatus)
      : fallback.qa_status;
  const reviewerPriority =
    typeof source.reviewer_priority === "string" &&
    REVIEWER_PRIORITIES.includes(source.reviewer_priority as ReviewerPriority)
      ? (source.reviewer_priority as ReviewerPriority)
      : fallback.reviewer_priority;

  return {
    qa_status: qaStatus,
    reviewer_priority: reviewerPriority,
    overall_score:
      typeof source.overall_score === "number"
        ? clampScore(source.overall_score)
        : fallback.overall_score,
    brand_fit_score:
      typeof source.brand_fit_score === "number"
        ? clampScore(source.brand_fit_score)
        : fallback.brand_fit_score,
    clarity_score:
      typeof source.clarity_score === "number"
        ? clampScore(source.clarity_score)
        : fallback.clarity_score,
    cta_score:
      typeof source.cta_score === "number"
        ? clampScore(source.cta_score)
        : fallback.cta_score,
    channel_fit_score:
      typeof source.channel_fit_score === "number"
        ? clampScore(source.channel_fit_score)
        : fallback.channel_fit_score,
    risk_score:
      typeof source.risk_score === "number"
        ? clampScore(source.risk_score)
        : fallback.risk_score,
    warnings: Array.isArray(source.warnings)
      ? source.warnings.filter(
          (item): item is string => typeof item === "string",
        )
      : fallback.warnings,
    suggestions: Array.isArray(source.suggestions)
      ? source.suggestions.filter(
          (item): item is string => typeof item === "string",
        )
      : fallback.suggestions,
    detected_issues: Array.isArray(source.detected_issues)
      ? source.detected_issues.filter(
          (item): item is string => typeof item === "string",
        )
      : fallback.detected_issues,
    analyzed_at:
      typeof source.analyzed_at === "string" ? source.analyzed_at : null,
    ready_for_review:
      typeof source.ready_for_review === "boolean"
        ? source.ready_for_review
        : fallback.ready_for_review,
  };
}

export function isAudienceFilter(value: string): value is AudienceType {
  return audienceTypes.includes(value as AudienceType);
}

export function isGoalFilter(value: string): value is CampaignGoal {
  return campaignGoals.includes(value as CampaignGoal);
}

export function isChannelFilter(value: string): value is ChannelType {
  return channelTypes.includes(value as ChannelType);
}

export function coerceCampaignStatus(
  value: string | null | undefined,
): CampaignWorkflowStatus | "" {
  return value && isWorkflowStatus(value) ? value : "";
}

export function coercePublishStatus(
  value: string | null | undefined,
): CampaignPublishStatus | "" {
  return value && isPublishStatus(value) ? value : "";
}

export function coerceAudienceFilter(
  value: string | null | undefined,
): AudienceType | "" {
  return value && isAudienceFilter(value) ? value : "";
}

export function coerceGoalFilter(
  value: string | null | undefined,
): CampaignGoal | "" {
  return value && isGoalFilter(value) ? value : "";
}

export function coerceChannelFilter(
  value: string | null | undefined,
): ChannelType | "" {
  return value && isChannelFilter(value) ? value : "";
}

export function coerceCampaignSortOrder(
  value: string | null | undefined,
): CampaignSortOrder {
  return value === "updated_asc" ? "updated_asc" : "updated_desc";
}

export function labelWorkflowStatus(status: CampaignWorkflowStatus): string {
  return status.replace(/_/g, " ");
}

export function labelPublishStatus(status: CampaignPublishStatus): string {
  return status.replace(/_/g, " ");
}

export function labelQueueStatus(status: CampaignPublishQueueStatus): string {
  return status.replace(/_/g, " ");
}

export function labelQueueErrorType(
  value: CampaignPublishQueueErrorType,
): string {
  return value.replace(/_/g, " ");
}

export function labelQueueHealthStatus(
  value: CampaignPublishQueueHealthStatus,
): string {
  return value.replace(/_/g, " ");
}

export function labelQueueDeferredReason(
  value: CampaignPublishQueueDeferredReason,
): string {
  return value.replace(/_/g, " ");
}

export function labelQaStatus(status: CampaignQaStatus): string {
  return status.replace(/_/g, " ");
}

export function labelReviewerPriority(priority: ReviewerPriority): string {
  return priority.replace(/_/g, " ");
}

export function labelDecisionStatus(
  status: CampaignVariantDecisionStatus,
): string {
  return status.replace(/_/g, " ");
}

export function labelDecisionEligibility(
  eligibility: CampaignDecisionEligibility,
): string {
  return eligibility.replace(/_/g, " ");
}

export function labelFeedbackType(type: CampaignFeedbackType): string {
  return type.replace(/_/g, " ");
}

export function labelPlacementCopySource(
  source: CampaignMessagePlacementSource,
): string {
  if (source === "ai_generated") return "AI generated";
  if (source === "manual_override") return "Manual override";
  return "Inherited";
}

export function labelChannel(channel: PublishChannel): string {
  if (channel === "meta") return "Meta ads";
  if (channel === "email") return "Email";
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "push") return "Push";
  if (channel === "google") return "Google ads";
  return "Landing";
}

export function labelGoal(goal: CampaignGoal): string {
  return goal.replace(/_/g, " ");
}

export function buildDefaultReviewChecklist(): CampaignReviewChecklist {
  return {
    brandAligned: false,
    messageClear: false,
    ctaCorrect: false,
    audienceCorrect: false,
    channelCorrect: false,
    claimsSafe: false,
    readyForApproval: false,
  };
}

export function normalizeDecisionStatus(
  value: unknown,
): CampaignVariantDecisionStatus {
  return typeof value === "string" &&
    CAMPAIGN_VARIANT_DECISION_STATUSES.includes(
      value as CampaignVariantDecisionStatus,
    )
    ? (value as CampaignVariantDecisionStatus)
    : "insufficient_data";
}

export function normalizeDecisionEligibility(
  value: unknown,
): CampaignDecisionEligibility {
  return typeof value === "string" &&
    CAMPAIGN_DECISION_ELIGIBILITIES.includes(
      value as CampaignDecisionEligibility,
    )
    ? (value as CampaignDecisionEligibility)
    : "limited";
}

export function normalizeDecisionSource(
  value: unknown,
): CampaignDecisionSource {
  return typeof value === "string" &&
    CAMPAIGN_DECISION_SOURCES.includes(value as CampaignDecisionSource)
    ? (value as CampaignDecisionSource)
    : "rule_based";
}

export function normalizeReviewChecklist(
  value: unknown,
): CampaignReviewChecklist {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<CampaignReviewChecklistKey, unknown>>)
      : {};

  return {
    brandAligned: source.brandAligned === true,
    messageClear: source.messageClear === true,
    ctaCorrect: source.ctaCorrect === true,
    audienceCorrect: source.audienceCorrect === true,
    channelCorrect: source.channelCorrect === true,
    claimsSafe: source.claimsSafe === true,
    readyForApproval: source.readyForApproval === true,
  };
}

export function labelChecklistField(key: CampaignReviewChecklistKey): string {
  if (key === "brandAligned") return "Aligned to brand";
  if (key === "messageClear") return "Message is clear";
  if (key === "ctaCorrect") return "CTA is correct";
  if (key === "audienceCorrect") return "Audience is correct";
  if (key === "channelCorrect") return "Channel is correct";
  if (key === "claimsSafe") return "No risky claims";
  return "Ready for approval";
}

export function buildCampaignTitle(input: {
  goal: CampaignGoal;
  serviceCategory: string;
  audience: AudienceType;
  title?: string;
}): string {
  const customTitle = input.title?.trim();
  if (customTitle) return customTitle;

  return `Handi ${input.goal} - ${input.serviceCategory} - ${input.audience}`;
}

export function buildVariantName(index: number): string {
  return `Variant ${index}`;
}

export function serializeMessageRationale(
  input: SerializeRationaleInput,
): string {
  const lines = [
    `${rationaleLabels.angle}: ${input.angle.trim()}`,
    `${rationaleLabels.audienceIntent}: ${input.audienceIntent.trim()}`,
    `${rationaleLabels.whyChannel}: ${input.whyChannel.trim()}`,
    `${rationaleLabels.whyCta}: ${input.whyCta.trim()}`,
  ];

  if (input.note?.trim()) {
    lines.push(`${rationaleLabels.note}: ${input.note.trim()}`);
  }

  if (input.summary?.trim()) {
    lines.push(`Summary: ${input.summary.trim()}`);
  }

  return lines.join("\n");
}

export function parseMessageRationale(raw: string): StructuredMessageRationale {
  const value = (raw || "").trim();
  if (!value) {
    return {
      angle: "",
      audienceIntent: "",
      whyChannel: "",
      whyCta: "",
      note: null,
      summary: "",
    };
  }

  const parsed: StructuredMessageRationale = {
    angle: "",
    audienceIntent: "",
    whyChannel: "",
    whyCta: "",
    note: null,
    summary: "",
  };

  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let matched = false;
  for (const line of lines) {
    const [label, ...rest] = line.split(":");
    const normalizedLabel = label.trim().toLowerCase();
    const content = rest.join(":").trim();

    if (!content) continue;

    if (normalizedLabel === rationaleLabels.angle.toLowerCase()) {
      parsed.angle = content;
      matched = true;
      continue;
    }
    if (normalizedLabel === rationaleLabels.audienceIntent.toLowerCase()) {
      parsed.audienceIntent = content;
      matched = true;
      continue;
    }
    if (normalizedLabel === rationaleLabels.whyChannel.toLowerCase()) {
      parsed.whyChannel = content;
      matched = true;
      continue;
    }
    if (normalizedLabel === rationaleLabels.whyCta.toLowerCase()) {
      parsed.whyCta = content;
      matched = true;
      continue;
    }
    if (normalizedLabel === rationaleLabels.note.toLowerCase()) {
      parsed.note = content;
      matched = true;
      continue;
    }
    if (normalizedLabel === "summary") {
      parsed.summary = content;
      matched = true;
    }
  }

  if (!matched) {
    return {
      angle: value,
      audienceIntent: "",
      whyChannel: "",
      whyCta: "",
      note: null,
      summary: value,
    };
  }

  const parts = [
    parsed.angle,
    parsed.audienceIntent,
    parsed.whyChannel,
    parsed.whyCta,
    parsed.note || "",
  ].filter(Boolean);
  parsed.summary = parsed.summary || parts.join(". ");

  return parsed;
}
