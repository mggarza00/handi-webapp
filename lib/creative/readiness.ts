import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type { CampaignCreativeBundleRow } from "@/lib/creative/workflow";
import type { PublishChannel } from "@/lib/campaigns/workflow";
import { getPublishableChannels } from "@/lib/publish/index";

type AdminSupabase = SupabaseClient<Database>;

export const VISUAL_READINESS_STATES = [
  "ready_exact",
  "ready_fallback",
  "partial",
  "missing",
  "manual_override",
  "blocked",
] as const;

export type VisualReadinessState = (typeof VISUAL_READINESS_STATES)[number];

export type ChannelVisualReadinessPolicy = {
  channel: PublishChannel;
  requiredFormat: string;
  allowFallback: boolean;
  exactPreferred: boolean;
  blockOnMissing: boolean;
  blockOnPartial: boolean;
  summary: string;
};

export type ChannelVisualReadinessReport = {
  channel: PublishChannel;
  requiredFormat: string;
  state: VisualReadinessState;
  isBlocked: boolean;
  isExact: boolean;
  acceptsFallback: boolean;
  bundleStatus: CampaignCreativeBundleRow["suitability_status"] | "missing";
  selectionSource: CampaignCreativeBundleRow["selection_source"] | "inferred";
  selectedAssetId: string | null;
  notes: string[];
  warnings: string[];
  missing: string[];
  summary: string;
};

export type CampaignVisualReadinessSummary = {
  campaignId: string;
  channels: ChannelVisualReadinessReport[];
  exactCount: number;
  fallbackCount: number;
  manualOverrideCount: number;
  partialCount: number;
  missingCount: number;
  blockedCount: number;
  readyCount: number;
  overallState: VisualReadinessState;
  summary: string;
};

const READINESS_POLICIES: Record<PublishChannel, ChannelVisualReadinessPolicy> =
  {
    email: {
      channel: "email",
      requiredFormat: "landscape",
      allowFallback: true,
      exactPreferred: false,
      blockOnMissing: true,
      blockOnPartial: false,
      summary:
        "Email accepts a reasonable approved fallback as long as a usable visual exists.",
    },
    push: {
      channel: "push",
      requiredFormat: "square",
      allowFallback: true,
      exactPreferred: false,
      blockOnMissing: true,
      blockOnPartial: false,
      summary:
        "Push accepts a reasonable approved fallback if the composition remains compact and legible.",
    },
    whatsapp: {
      channel: "whatsapp",
      requiredFormat: "portrait",
      allowFallback: true,
      exactPreferred: false,
      blockOnMissing: true,
      blockOnPartial: false,
      summary:
        "WhatsApp can proceed with portrait-adjacent approved coverage, but still requires a visual selection.",
    },
    meta: {
      channel: "meta",
      requiredFormat: "square",
      allowFallback: false,
      exactPreferred: true,
      blockOnMissing: true,
      blockOnPartial: true,
      summary:
        "Meta export should have an exact approved channel-ready creative unless a human override explicitly takes responsibility.",
    },
    google: {
      channel: "google",
      requiredFormat: "landscape",
      allowFallback: false,
      exactPreferred: true,
      blockOnMissing: true,
      blockOnPartial: true,
      summary:
        "Google export should have a wide approved creative aligned to ad-safe dimensions.",
    },
    landing: {
      channel: "landing",
      requiredFormat: "landscape",
      allowFallback: false,
      exactPreferred: true,
      blockOnMissing: true,
      blockOnPartial: true,
      summary:
        "Landing handoff should include a hero/banner-appropriate approved creative.",
    },
  };

function getPolicy(channel: PublishChannel): ChannelVisualReadinessPolicy {
  return READINESS_POLICIES[channel];
}

type MinimalBundle = Pick<
  CampaignCreativeBundleRow,
  | "channel"
  | "required_format"
  | "suitability_status"
  | "selection_source"
  | "selected_master_asset_id"
  | "selected_derivative_asset_id"
  | "notes"
> & {
  selected_asset?: { id: string } | null;
};

export function evaluateChannelVisualReadiness(args: {
  channel: PublishChannel;
  bundle: MinimalBundle | null;
}): ChannelVisualReadinessReport {
  const policy = getPolicy(args.channel);
  const bundle = args.bundle;
  const selectedAssetId =
    bundle?.selected_asset?.id ||
    bundle?.selected_derivative_asset_id ||
    bundle?.selected_master_asset_id ||
    null;
  const warnings: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [policy.summary];

  if (!bundle || !selectedAssetId) {
    missing.push(
      `No approved ${policy.requiredFormat} visual is selected for ${args.channel}.`,
    );
    return {
      channel: args.channel,
      requiredFormat: policy.requiredFormat,
      state: "missing",
      isBlocked: policy.blockOnMissing,
      isExact: false,
      acceptsFallback: policy.allowFallback,
      bundleStatus: "missing",
      selectionSource: "inferred",
      selectedAssetId: null,
      notes,
      warnings,
      missing,
      summary: `Missing visual coverage for ${args.channel}.`,
    };
  }

  if (bundle.selection_source === "manual") {
    warnings.push(
      "Manual override is active. The selected visual should be reviewed carefully before handoff.",
    );
    if (bundle.suitability_status === "partial") {
      warnings.push(
        "Manual override is using a fallback or non-exact visual for this channel.",
      );
    }
    return {
      channel: args.channel,
      requiredFormat: bundle.required_format,
      state: "manual_override",
      isBlocked: false,
      isExact: bundle.suitability_status === "ready",
      acceptsFallback: policy.allowFallback,
      bundleStatus: bundle.suitability_status,
      selectionSource: bundle.selection_source,
      selectedAssetId,
      notes,
      warnings,
      missing,
      summary: `Manual override selected a visual for ${args.channel}.`,
    };
  }

  if (bundle.suitability_status === "ready") {
    return {
      channel: args.channel,
      requiredFormat: bundle.required_format,
      state: "ready_exact",
      isBlocked: false,
      isExact: true,
      acceptsFallback: policy.allowFallback,
      bundleStatus: bundle.suitability_status,
      selectionSource: bundle.selection_source,
      selectedAssetId,
      notes,
      warnings,
      missing,
      summary: `Exact visual coverage is ready for ${args.channel}.`,
    };
  }

  if (bundle.suitability_status === "partial") {
    if (policy.allowFallback) {
      warnings.push(
        `Using fallback visual coverage for ${args.channel}. Exact ${policy.requiredFormat} coverage is still recommended.`,
      );
      return {
        channel: args.channel,
        requiredFormat: bundle.required_format,
        state: "ready_fallback",
        isBlocked: false,
        isExact: false,
        acceptsFallback: policy.allowFallback,
        bundleStatus: bundle.suitability_status,
        selectionSource: bundle.selection_source,
        selectedAssetId,
        notes,
        warnings,
        missing,
        summary: `Fallback visual coverage is acceptable for ${args.channel}.`,
      };
    }

    missing.push(
      `This channel still needs exact ${policy.requiredFormat} coverage.`,
    );
    return {
      channel: args.channel,
      requiredFormat: bundle.required_format,
      state: policy.blockOnPartial ? "blocked" : "partial",
      isBlocked: policy.blockOnPartial,
      isExact: false,
      acceptsFallback: policy.allowFallback,
      bundleStatus: bundle.suitability_status,
      selectionSource: bundle.selection_source,
      selectedAssetId,
      notes,
      warnings,
      missing,
      summary: policy.blockOnPartial
        ? `${args.channel} is blocked until exact visual coverage exists or a human override is set.`
        : `${args.channel} only has partial visual coverage.`,
    };
  }

  return {
    channel: args.channel,
    requiredFormat: bundle.required_format,
    state: "partial",
    isBlocked: false,
    isExact: false,
    acceptsFallback: policy.allowFallback,
    bundleStatus: bundle.suitability_status,
    selectionSource: bundle.selection_source,
    selectedAssetId,
    notes,
    warnings,
    missing,
    summary: `Visual readiness for ${args.channel} needs review.`,
  };
}

export function evaluateCampaignVisualReadiness(args: {
  campaignId: string;
  channels: string[];
  bundles: MinimalBundle[];
}): CampaignVisualReadinessSummary {
  const publishableChannels = getPublishableChannels(
    args.channels as never,
  ).map((connector) => connector.channel);
  const bundleByChannel = new Map(
    args.bundles.map((bundle) => [bundle.channel, bundle]),
  );
  const channels = publishableChannels.map((channel) =>
    evaluateChannelVisualReadiness({
      channel,
      bundle: bundleByChannel.get(channel) || null,
    }),
  );

  const exactCount = channels.filter(
    (item) => item.state === "ready_exact",
  ).length;
  const fallbackCount = channels.filter(
    (item) => item.state === "ready_fallback",
  ).length;
  const manualOverrideCount = channels.filter(
    (item) => item.state === "manual_override",
  ).length;
  const partialCount = channels.filter(
    (item) => item.state === "partial",
  ).length;
  const missingCount = channels.filter(
    (item) => item.state === "missing",
  ).length;
  const blockedCount = channels.filter(
    (item) => item.state === "blocked" || item.isBlocked,
  ).length;
  const readyCount = channels.filter((item) =>
    ["ready_exact", "ready_fallback", "manual_override"].includes(item.state),
  ).length;

  let overallState: VisualReadinessState = "ready_exact";
  if (blockedCount) overallState = "blocked";
  else if (missingCount) overallState = "missing";
  else if (partialCount) overallState = "partial";
  else if (manualOverrideCount) overallState = "manual_override";
  else if (fallbackCount) overallState = "ready_fallback";

  const summary = blockedCount
    ? `${blockedCount} channel${blockedCount === 1 ? "" : "s"} blocked by visual readiness.`
    : missingCount
      ? `${missingCount} channel${missingCount === 1 ? "" : "s"} still missing visual coverage.`
      : manualOverrideCount
        ? `${manualOverrideCount} channel${manualOverrideCount === 1 ? "" : "s"} depend on manual visual overrides.`
        : fallbackCount
          ? `${fallbackCount} channel${fallbackCount === 1 ? "" : "s"} are ready on fallback visual coverage.`
          : "All publishable channels have exact visual coverage.";

  return {
    campaignId: args.campaignId,
    channels,
    exactCount,
    fallbackCount,
    manualOverrideCount,
    partialCount,
    missingCount,
    blockedCount,
    readyCount,
    overallState,
    summary,
  };
}

export async function listCampaignVisualReadinessSummaries(args: {
  admin: AdminSupabase;
  campaigns: Array<{ id: string; channels: string[] }>;
}) {
  const campaignIds = args.campaigns
    .map((campaign) => campaign.id)
    .filter(Boolean);
  if (!campaignIds.length)
    return new Map<string, CampaignVisualReadinessSummary>();

  const { data, error } = await args.admin
    .from("campaign_creative_bundles")
    .select(
      "campaign_draft_id, channel, required_format, suitability_status, selection_source, selected_master_asset_id, selected_derivative_asset_id, notes",
    )
    .in("campaign_draft_id", campaignIds);

  if (error) {
    throw new Error(
      error.message || "failed to load campaign visual readiness",
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const bundleRowsByCampaign = new Map<string, MinimalBundle[]>();
  rows.forEach((row) => {
    const value = row as Record<string, unknown>;
    const campaignId =
      typeof value.campaign_draft_id === "string"
        ? value.campaign_draft_id
        : "";
    const current = bundleRowsByCampaign.get(campaignId) || [];
    current.push({
      channel: value.channel as PublishChannel,
      required_format: String(value.required_format || ""),
      suitability_status:
        (value.suitability_status as CampaignCreativeBundleRow["suitability_status"]) ||
        "missing",
      selection_source:
        (value.selection_source as CampaignCreativeBundleRow["selection_source"]) ||
        "inferred",
      selected_master_asset_id:
        typeof value.selected_master_asset_id === "string"
          ? value.selected_master_asset_id
          : null,
      selected_derivative_asset_id:
        typeof value.selected_derivative_asset_id === "string"
          ? value.selected_derivative_asset_id
          : null,
      notes: typeof value.notes === "string" ? value.notes : null,
    });
    bundleRowsByCampaign.set(campaignId, current);
  });

  const summaries = new Map<string, CampaignVisualReadinessSummary>();
  args.campaigns.forEach((campaign) => {
    summaries.set(
      campaign.id,
      evaluateCampaignVisualReadiness({
        campaignId: campaign.id,
        channels: campaign.channels,
        bundles: bundleRowsByCampaign.get(campaign.id) || [],
      }),
    );
  });

  return summaries;
}

export function isVisualReadinessBlocked(report: ChannelVisualReadinessReport) {
  return report.isBlocked || report.state === "blocked";
}

export function labelVisualReadinessState(state: VisualReadinessState) {
  return state.replace(/_/g, " ");
}
