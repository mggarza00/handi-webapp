import type { ProviderMetadata } from "@/lib/ai/schemas";
import type {
  CampaignWorkflowStatus,
  PublishChannel,
} from "@/lib/campaigns/workflow";

export const CREATIVE_ASSET_TYPES = ["image"] as const;
export const CREATIVE_JOB_TYPES = ["generation", "adaptation"] as const;
export const CREATIVE_ASSET_ROLES = ["master", "derivative"] as const;
export const CREATIVE_ASSET_FORMATS = [
  "square",
  "portrait",
  "landscape",
  "story",
  "custom",
] as const;
export const CREATIVE_GENERATION_STATUSES = [
  "draft",
  "proposed",
  "changes_requested",
  "approved",
  "rejected",
  "archived",
] as const;
export const CREATIVE_FEEDBACK_TYPES = [
  "approve",
  "reject",
  "request_changes",
  "regenerate",
  "manual_edit",
] as const;
export const CREATIVE_ADAPTATION_METHODS = [
  "crop",
  "pad",
  "resize",
  "ai_extend",
  "provider_regenerate",
] as const;
export const CREATIVE_BUNDLE_SUITABILITY_STATUSES = [
  "ready",
  "missing",
  "partial",
  "manual_override",
] as const;
export const CREATIVE_BUNDLE_SELECTION_SOURCES = [
  "manual",
  "inferred",
  "channel_default",
] as const;

export type CreativeJobType = (typeof CREATIVE_JOB_TYPES)[number];
export type CreativeAssetRole = (typeof CREATIVE_ASSET_ROLES)[number];
export type CreativeAssetType = (typeof CREATIVE_ASSET_TYPES)[number];
export type CreativeAssetFormat = (typeof CREATIVE_ASSET_FORMATS)[number];
export type CreativeGenerationStatus =
  (typeof CREATIVE_GENERATION_STATUSES)[number];
export type CreativeFeedbackType = (typeof CREATIVE_FEEDBACK_TYPES)[number];
export type CreativeAdaptationMethod =
  (typeof CREATIVE_ADAPTATION_METHODS)[number];
export type CreativeBundleSuitabilityStatus =
  (typeof CREATIVE_BUNDLE_SUITABILITY_STATUSES)[number];
export type CreativeBundleSelectionSource =
  (typeof CREATIVE_BUNDLE_SELECTION_SOURCES)[number];

export type CreativeBriefPayload = {
  visualPrompt: string;
  briefSummary: string;
  rationaleSummary: string;
  targetFormat: CreativeAssetFormat;
  compositionNotes: string[];
  visualConstraints: string[];
  textOverlayGuidance: string[];
  references: string[];
  channel: PublishChannel;
  serviceCategory: string;
  audience: string;
  goal: string;
};

export type CreativeAssetJobRow = {
  id: string;
  campaign_draft_id: string;
  campaign_message_id: string | null;
  channel: PublishChannel;
  job_type: CreativeJobType;
  parent_creative_asset_id: string | null;
  asset_type: CreativeAssetType;
  generation_status: CreativeGenerationStatus;
  provider_name: string;
  provider_mode: ProviderMetadata["generationMode"];
  brief_summary: string;
  rationale_summary: string;
  brief_payload: CreativeBriefPayload;
  target_channel: PublishChannel | null;
  target_width: number | null;
  target_height: number | null;
  adaptation_method: CreativeAdaptationMethod | null;
  provider_metadata: ProviderMetadata | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CreativeAssetRow = {
  id: string;
  creative_asset_job_id: string;
  asset_role: CreativeAssetRole;
  parent_asset_id: string | null;
  variant_label: string;
  format: CreativeAssetFormat;
  target_channel: PublishChannel | null;
  target_width: number | null;
  target_height: number | null;
  adaptation_method: CreativeAdaptationMethod | null;
  channel_suitability: PublishChannel[];
  storage_path: string;
  prompt_text: string;
  rationale: string;
  status: CreativeGenerationStatus;
  is_current: boolean;
  provider_metadata: ProviderMetadata | null;
  created_at: string;
  updated_at: string;
};

export type CreativeAssetVersionRow = {
  id: string;
  creative_asset_id: string;
  version_number: number;
  format: CreativeAssetFormat;
  target_channel: PublishChannel | null;
  target_width: number | null;
  target_height: number | null;
  adaptation_method: CreativeAdaptationMethod | null;
  channel_suitability: PublishChannel[];
  storage_path: string;
  prompt_text: string;
  rationale: string;
  edited_by: string | null;
  created_at: string;
};

export type CampaignCreativeBundleRow = {
  id: string;
  campaign_draft_id: string;
  channel: PublishChannel;
  selected_master_asset_id: string | null;
  selected_derivative_asset_id: string | null;
  required_format: CreativeAssetFormat;
  suitability_status: CreativeBundleSuitabilityStatus;
  selection_source: CreativeBundleSelectionSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreativeAssetFeedbackRow = {
  id: string;
  creative_asset_job_id: string;
  creative_asset_id: string | null;
  feedback_type: CreativeFeedbackType;
  feedback_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type CreativeAssetView = CreativeAssetRow & {
  preview_url: string | null;
  version_count: number;
  latest_version: CreativeAssetVersionRow | null;
  original_version: CreativeAssetVersionRow | null;
  versions: CreativeAssetVersionView[];
};

export type CreativeAssetVersionView = CreativeAssetVersionRow & {
  preview_url: string | null;
};

export type CreativeAssetJobListItem = CreativeAssetJobRow & {
  campaign_title: string;
  message_variant_name: string | null;
  asset_count: number;
  current_asset_id: string | null;
  current_asset_format: CreativeAssetFormat | null;
  current_asset_role: CreativeAssetRole | null;
  current_asset_preview_url: string | null;
  last_feedback_note: string | null;
  created_by_label: string | null;
};

export type CreativeDerivativeListItem = CreativeAssetView & {
  job_id: string;
  campaign_draft_id: string;
  campaign_title: string;
  channel: PublishChannel;
  generation_status: CreativeGenerationStatus;
  provider_name: string;
  provider_mode: ProviderMetadata["generationMode"];
  message_variant_name: string | null;
};

export type CampaignCreativeBundleAssetView = Pick<
  CreativeAssetRow,
  | "id"
  | "creative_asset_job_id"
  | "asset_role"
  | "parent_asset_id"
  | "variant_label"
  | "format"
  | "target_channel"
  | "target_width"
  | "target_height"
  | "adaptation_method"
  | "channel_suitability"
  | "storage_path"
  | "status"
  | "provider_metadata"
  | "updated_at"
> & {
  preview_url: string | null;
};

export type CampaignCreativeBundleView = CampaignCreativeBundleRow & {
  selected_asset: CampaignCreativeBundleAssetView | null;
  selected_master_asset: CampaignCreativeBundleAssetView | null;
  summary: string;
};

export type CreativeAssetJobDetail = {
  job: CreativeAssetJobRow;
  assets: CreativeAssetView[];
  feedback: CreativeAssetFeedbackRow[];
  actor_names: Record<string, string>;
  campaign_title: string;
  campaign_status: CampaignWorkflowStatus;
  message_variant_name: string | null;
};

export function normalizeCreativeAssetType(value: unknown): CreativeAssetType {
  return value === "image" ? "image" : "image";
}

export function normalizeCreativeJobType(value: unknown): CreativeJobType {
  return value === "adaptation" ? "adaptation" : "generation";
}

export function normalizeCreativeAssetRole(value: unknown): CreativeAssetRole {
  return value === "derivative" ? "derivative" : "master";
}

export function normalizeCreativeAssetFormat(
  value: unknown,
): CreativeAssetFormat {
  if (
    typeof value === "string" &&
    CREATIVE_ASSET_FORMATS.includes(value as CreativeAssetFormat)
  ) {
    return value as CreativeAssetFormat;
  }
  return "square";
}

export function normalizeCreativeGenerationStatus(
  value: unknown,
): CreativeGenerationStatus {
  if (
    typeof value === "string" &&
    CREATIVE_GENERATION_STATUSES.includes(value as CreativeGenerationStatus)
  ) {
    return value as CreativeGenerationStatus;
  }
  return "proposed";
}

export function normalizeCreativeFeedbackType(
  value: unknown,
): CreativeFeedbackType {
  if (
    typeof value === "string" &&
    CREATIVE_FEEDBACK_TYPES.includes(value as CreativeFeedbackType)
  ) {
    return value as CreativeFeedbackType;
  }
  return "request_changes";
}

export function normalizeCreativeAdaptationMethod(
  value: unknown,
): CreativeAdaptationMethod | null {
  if (
    typeof value === "string" &&
    CREATIVE_ADAPTATION_METHODS.includes(value as CreativeAdaptationMethod)
  ) {
    return value as CreativeAdaptationMethod;
  }
  return null;
}

export function normalizeCreativeBundleSuitabilityStatus(
  value: unknown,
): CreativeBundleSuitabilityStatus {
  if (
    typeof value === "string" &&
    CREATIVE_BUNDLE_SUITABILITY_STATUSES.includes(
      value as CreativeBundleSuitabilityStatus,
    )
  ) {
    return value as CreativeBundleSuitabilityStatus;
  }
  return "missing";
}

export function normalizeCreativeBundleSelectionSource(
  value: unknown,
): CreativeBundleSelectionSource {
  if (
    typeof value === "string" &&
    CREATIVE_BUNDLE_SELECTION_SOURCES.includes(
      value as CreativeBundleSelectionSource,
    )
  ) {
    return value as CreativeBundleSelectionSource;
  }
  return "inferred";
}

export function labelCreativeFormat(value: CreativeAssetFormat): string {
  if (value === "square") return "Square";
  if (value === "portrait") return "Portrait";
  if (value === "landscape") return "Landscape";
  if (value === "story") return "Story";
  return "Custom";
}

export function labelCreativeJobType(value: CreativeJobType): string {
  return value === "adaptation" ? "Adaptation" : "Generation";
}

export function labelCreativeAssetRole(value: CreativeAssetRole): string {
  return value === "derivative" ? "Derivative" : "Master";
}

export function labelCreativeFeedbackType(value: CreativeFeedbackType): string {
  if (value === "approve") return "Approve";
  if (value === "reject") return "Reject";
  if (value === "request_changes") return "Request changes";
  if (value === "regenerate") return "Regenerate";
  return "Manual edit";
}

export function labelCreativeAdaptationMethod(
  value: CreativeAdaptationMethod | null,
): string {
  if (value === "crop") return "Crop";
  if (value === "pad") return "Pad";
  if (value === "resize") return "Resize";
  if (value === "ai_extend") return "AI extend";
  if (value === "provider_regenerate") return "Provider regenerate";
  return "Not set";
}

export function labelCreativeBundleSuitabilityStatus(
  value: CreativeBundleSuitabilityStatus,
): string {
  if (value === "manual_override") return "Manual override";
  return value.replace(/_/g, " ");
}

export function labelCreativeBundleSelectionSource(
  value: CreativeBundleSelectionSource,
): string {
  if (value === "channel_default") return "Channel default";
  return value.replace(/_/g, " ");
}

export function buildCreativeGenerationStatusFromFeedback(
  value: CreativeFeedbackType,
): CreativeGenerationStatus {
  if (value === "approve") return "approved";
  if (value === "reject") return "rejected";
  if (value === "request_changes") return "changes_requested";
  return "proposed";
}
