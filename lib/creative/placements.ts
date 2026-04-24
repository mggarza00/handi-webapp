import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import { createCreativeAssetSignedUrl } from "@/lib/creative/storage";
import type {
  CampaignCreativeBundleView,
  CreativeAssetFormat,
} from "@/lib/creative/workflow";
import type { PublishChannel } from "@/lib/campaigns/workflow";

type AdminSupabase = SupabaseClient<Database>;

export const CREATIVE_PLACEMENT_IDS = [
  "email_primary",
  "push_primary",
  "whatsapp_primary",
  "meta_feed_square",
  "meta_feed_portrait",
  "meta_story_vertical",
  "meta_reel_vertical",
  "meta_right_column_landscape",
  "google_display_landscape",
  "google_display_square",
  "google_responsive_display_landscape",
  "google_responsive_display_square",
  "landing_hero",
  "landing_secondary_banner",
] as const;

export type CreativePlacementId = (typeof CREATIVE_PLACEMENT_IDS)[number];

export type CreativePlacementDefinition = {
  id: CreativePlacementId;
  channel: PublishChannel;
  label: string;
  handoffName: string;
  placementFamily: "paid" | "owned";
  placementGroup:
    | "feed"
    | "story"
    | "reel"
    | "right_column"
    | "display"
    | "responsive_display"
    | "hero"
    | "secondary_banner"
    | "primary";
  platformLabel: string;
  operationalName: string;
  requiredFormat: CreativeAssetFormat;
  preferredDimensions: {
    width: number;
    height: number;
  };
  acceptableFormats: CreativeAssetFormat[];
  allowFallback: boolean;
  blockOnMissing: boolean;
  blockOnFallback: boolean;
  copyStyle: "standard" | "tight" | "direct" | "compact" | "hero";
  copyGuidance: string;
  namingHint: string;
  notes: string[];
};

export type PlacementSelectionSource =
  | "manual_override"
  | "channel_bundle"
  | "placement_inferred"
  | "placement_fallback"
  | "missing";

export type PlacementReadinessState =
  | "ready_exact"
  | "ready_fallback"
  | "partial"
  | "missing"
  | "manual_override"
  | "blocked";

export type PlacementAssetView = {
  id: string;
  role: "master" | "derivative";
  variantLabel: string;
  format: CreativeAssetFormat;
  targetChannel: PublishChannel | null;
  width: number | null;
  height: number | null;
  adaptationMethod: string | null;
  channelSuitability: PublishChannel[];
  storagePath: string;
  providerMetadata: Record<string, unknown> | null;
  updatedAt: string;
  previewUrl: string | null;
};

export type PlacementReadinessReport = {
  placementId: CreativePlacementId;
  placementLabel: string;
  handoffName: string;
  channel: PublishChannel;
  requiredFormat: CreativeAssetFormat;
  preferredDimensions: {
    width: number;
    height: number;
  };
  state: PlacementReadinessState;
  isBlocked: boolean;
  isExact: boolean;
  acceptsFallback: boolean;
  selectionSource: PlacementSelectionSource;
  selectedFromBundle: boolean;
  selectedAsset: PlacementAssetView | null;
  notes: string[];
  warnings: string[];
  missing: string[];
  summary: string;
};

export type ChannelPlacementCoverageSummary = {
  channel: PublishChannel;
  placements: PlacementReadinessReport[];
  exactCount: number;
  fallbackCount: number;
  manualOverrideCount: number;
  blockedCount: number;
  missingCount: number;
  overallState: PlacementReadinessState;
  summary: string;
};

export type CampaignPlacementCoverageSummary = {
  campaignId: string;
  channels: ChannelPlacementCoverageSummary[];
  exactCount: number;
  fallbackCount: number;
  manualOverrideCount: number;
  blockedCount: number;
  missingCount: number;
  overallState: PlacementReadinessState;
  summary: string;
};

type PlacementCandidate = {
  id: string;
  creativeAssetJobId: string;
  role: "master" | "derivative";
  parentAssetId: string | null;
  variantLabel: string;
  format: CreativeAssetFormat;
  targetChannel: PublishChannel | null;
  width: number | null;
  height: number | null;
  adaptationMethod: string | null;
  channelSuitability: PublishChannel[];
  storagePath: string;
  providerMetadata: Record<string, unknown> | null;
  updatedAt: string;
  jobChannel: PublishChannel;
  previewUrl: string | null;
};

const PLACEMENTS: Record<CreativePlacementId, CreativePlacementDefinition> = {
  email_primary: {
    id: "email_primary",
    channel: "email",
    label: "Email primary",
    handoffName: "email-primary",
    placementFamily: "owned",
    placementGroup: "primary",
    platformLabel: "Email",
    operationalName: "Email primary module",
    requiredFormat: "landscape",
    preferredDimensions: { width: 1200, height: 628 },
    acceptableFormats: ["landscape", "custom"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "standard",
    copyGuidance:
      "Email placement copy can carry more context, but it should still stay tighter than the base channel version.",
    namingHint: "email-primary",
    notes: [
      "Email can ship with a wide approved fallback if hierarchy remains clear.",
    ],
  },
  push_primary: {
    id: "push_primary",
    channel: "push",
    label: "Push primary",
    handoffName: "push-primary",
    placementFamily: "owned",
    placementGroup: "primary",
    platformLabel: "Push",
    operationalName: "Push primary slot",
    requiredFormat: "square",
    preferredDimensions: { width: 1080, height: 1080 },
    acceptableFormats: ["square", "portrait"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "compact",
    copyGuidance:
      "Push placement copy must stay compact, low-friction, and CTA-led.",
    namingHint: "push-primary",
    notes: [
      "Push can use a compact portrait fallback when composition stays legible.",
    ],
  },
  whatsapp_primary: {
    id: "whatsapp_primary",
    channel: "whatsapp",
    label: "WhatsApp primary",
    handoffName: "whatsapp-primary",
    placementFamily: "owned",
    placementGroup: "primary",
    platformLabel: "WhatsApp",
    operationalName: "WhatsApp primary media slot",
    requiredFormat: "portrait",
    preferredDimensions: { width: 1080, height: 1350 },
    acceptableFormats: ["portrait", "story", "square"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "standard",
    copyGuidance:
      "WhatsApp placement copy should sound direct, useful, and easy to reply to.",
    namingHint: "whatsapp-primary",
    notes: ["WhatsApp can accept portrait-adjacent fallback coverage."],
  },
  meta_feed_square: {
    id: "meta_feed_square",
    channel: "meta",
    label: "Meta feed square",
    handoffName: "meta-feed-square",
    placementFamily: "paid",
    placementGroup: "feed",
    platformLabel: "Meta",
    operationalName: "Meta feed 1:1",
    requiredFormat: "square",
    preferredDimensions: { width: 1080, height: 1080 },
    acceptableFormats: ["square"],
    allowFallback: false,
    blockOnMissing: true,
    blockOnFallback: true,
    copyStyle: "tight",
    copyGuidance:
      "Keep the hook tight for a feed square placement. Prioritize one benefit, one trust cue, and short body copy.",
    namingHint: "meta-feed-square",
    notes: ["Meta feed square should ship with exact square creative."],
  },
  meta_feed_portrait: {
    id: "meta_feed_portrait",
    channel: "meta",
    label: "Meta feed portrait",
    handoffName: "meta-feed-portrait",
    placementFamily: "paid",
    placementGroup: "feed",
    platformLabel: "Meta",
    operationalName: "Meta feed 4:5",
    requiredFormat: "portrait",
    preferredDimensions: { width: 1080, height: 1350 },
    acceptableFormats: ["portrait"],
    allowFallback: false,
    blockOnMissing: true,
    blockOnFallback: true,
    copyStyle: "tight",
    copyGuidance:
      "Use a faster 4:5 feed rhythm. Keep the opening line compact and the CTA direct without sounding pushy.",
    namingHint: "meta-feed-portrait",
    notes: ["Meta portrait feed should have exact 4:5-friendly coverage."],
  },
  meta_story_vertical: {
    id: "meta_story_vertical",
    channel: "meta",
    label: "Meta story vertical",
    handoffName: "meta-story-vertical",
    placementFamily: "paid",
    placementGroup: "story",
    platformLabel: "Meta",
    operationalName: "Meta story 9:16",
    requiredFormat: "story",
    preferredDimensions: { width: 1080, height: 1920 },
    acceptableFormats: ["story", "portrait"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "direct",
    copyGuidance:
      "Stories need a quicker hook, shorter copy, and CTA language that lands in one glance.",
    namingHint: "meta-story-vertical",
    notes: [
      "Story vertical can use a portrait fallback, but exact 9:16 is preferred.",
    ],
  },
  meta_reel_vertical: {
    id: "meta_reel_vertical",
    channel: "meta",
    label: "Meta reel vertical",
    handoffName: "meta-reel-vertical",
    placementFamily: "paid",
    placementGroup: "reel",
    platformLabel: "Meta",
    operationalName: "Meta reel 9:16",
    requiredFormat: "story",
    preferredDimensions: { width: 1080, height: 1920 },
    acceptableFormats: ["story", "portrait"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "direct",
    copyGuidance:
      "Reels need a fast hook and very short support copy. Prioritize punchy, trust-first lines that survive low attention.",
    namingHint: "meta-reel-vertical",
    notes: [
      "Reels can reuse 9:16 story assets when composition remains centered and legible.",
    ],
  },
  meta_right_column_landscape: {
    id: "meta_right_column_landscape",
    channel: "meta",
    label: "Meta right column landscape",
    handoffName: "meta-right-column-landscape",
    placementFamily: "paid",
    placementGroup: "right_column",
    platformLabel: "Meta",
    operationalName: "Meta right column wide",
    requiredFormat: "landscape",
    preferredDimensions: { width: 1200, height: 628 },
    acceptableFormats: ["landscape", "custom"],
    allowFallback: false,
    blockOnMissing: true,
    blockOnFallback: true,
    copyStyle: "compact",
    copyGuidance:
      "Right column copy must be concise and utility-first because the format is visually smaller and lower-attention.",
    namingHint: "meta-right-column",
    notes: [
      "Right column requires a wide asset and concise copy that still lands without motion.",
    ],
  },
  google_display_landscape: {
    id: "google_display_landscape",
    channel: "google",
    label: "Google display landscape",
    handoffName: "google-display-landscape",
    placementFamily: "paid",
    placementGroup: "display",
    platformLabel: "Google",
    operationalName: "Google display wide",
    requiredFormat: "landscape",
    preferredDimensions: { width: 1200, height: 628 },
    acceptableFormats: ["landscape", "custom"],
    allowFallback: false,
    blockOnMissing: true,
    blockOnFallback: true,
    copyStyle: "compact",
    copyGuidance:
      "Compress the copy for a display-style wide placement. Keep headline and body highly scannable.",
    namingHint: "google-display-landscape",
    notes: ["Google display landscape should use a wide approved creative."],
  },
  google_display_square: {
    id: "google_display_square",
    channel: "google",
    label: "Google display square",
    handoffName: "google-display-square",
    placementFamily: "paid",
    placementGroup: "display",
    platformLabel: "Google",
    operationalName: "Google display square",
    requiredFormat: "square",
    preferredDimensions: { width: 1080, height: 1080 },
    acceptableFormats: ["square"],
    allowFallback: false,
    blockOnMissing: true,
    blockOnFallback: true,
    copyStyle: "compact",
    copyGuidance: "Square display copy should stay concise and utility-first.",
    namingHint: "google-display-square",
    notes: ["Google square display should use exact square coverage."],
  },
  google_responsive_display_landscape: {
    id: "google_responsive_display_landscape",
    channel: "google",
    label: "Google responsive display landscape",
    handoffName: "google-responsive-display-landscape",
    placementFamily: "paid",
    placementGroup: "responsive_display",
    platformLabel: "Google",
    operationalName: "Google responsive display wide",
    requiredFormat: "landscape",
    preferredDimensions: { width: 1200, height: 628 },
    acceptableFormats: ["landscape", "custom"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "compact",
    copyGuidance:
      "Responsive display landscape still needs concise copy, but it can tolerate slightly broader message coverage than static display placements.",
    namingHint: "google-rda-landscape",
    notes: [
      "Responsive display landscape can accept approved wide fallback coverage when exact creative is not available.",
    ],
  },
  google_responsive_display_square: {
    id: "google_responsive_display_square",
    channel: "google",
    label: "Google responsive display square",
    handoffName: "google-responsive-display-square",
    placementFamily: "paid",
    placementGroup: "responsive_display",
    platformLabel: "Google",
    operationalName: "Google responsive display square",
    requiredFormat: "square",
    preferredDimensions: { width: 1200, height: 1200 },
    acceptableFormats: ["square"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "compact",
    copyGuidance:
      "Responsive display square should stay concise while keeping one clear value prop and one CTA cue.",
    namingHint: "google-rda-square",
    notes: [
      "Responsive display square can be packed with approved square fallback assets for manual media setup.",
    ],
  },
  landing_hero: {
    id: "landing_hero",
    channel: "landing",
    label: "Landing hero",
    handoffName: "landing-hero",
    placementFamily: "owned",
    placementGroup: "hero",
    platformLabel: "Landing",
    operationalName: "Landing hero",
    requiredFormat: "landscape",
    preferredDimensions: { width: 1440, height: 720 },
    acceptableFormats: ["landscape", "custom"],
    allowFallback: false,
    blockOnMissing: true,
    blockOnFallback: true,
    copyStyle: "hero",
    copyGuidance:
      "Landing hero copy should make the main promise crystal clear in the first read and support a strong headline/subheadline structure.",
    namingHint: "landing-hero",
    notes: ["Landing hero should have a wide approved visual."],
  },
  landing_secondary_banner: {
    id: "landing_secondary_banner",
    channel: "landing",
    label: "Landing secondary banner",
    handoffName: "landing-secondary-banner",
    placementFamily: "owned",
    placementGroup: "secondary_banner",
    platformLabel: "Landing",
    operationalName: "Landing secondary banner",
    requiredFormat: "custom",
    preferredDimensions: { width: 1200, height: 450 },
    acceptableFormats: ["custom", "landscape"],
    allowFallback: true,
    blockOnMissing: true,
    blockOnFallback: false,
    copyStyle: "standard",
    copyGuidance:
      "Secondary landing banner copy should reinforce the offer with a narrower, supporting message.",
    namingHint: "landing-secondary-banner",
    notes: [
      "Secondary banner can use a landscape fallback if a custom strip is not available.",
    ],
  },
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function listCreativePlacements() {
  return Object.values(PLACEMENTS);
}

export function getCreativePlacementDefinition(
  placementId: CreativePlacementId,
) {
  return PLACEMENTS[placementId];
}

export function getCreativePlacementsForChannel(channel: PublishChannel) {
  return listCreativePlacements().filter(
    (placement) => placement.channel === channel,
  );
}

export function labelCreativePlacement(placementId: CreativePlacementId) {
  return getCreativePlacementDefinition(placementId).label;
}

export function labelPlacementReadinessState(state: PlacementReadinessState) {
  return state.replace(/_/g, " ");
}

async function listApprovedPlacementCandidates(
  admin: AdminSupabase,
  campaignId: string,
): Promise<PlacementCandidate[]> {
  const { data: jobRows, error: jobError } = await admin
    .from("creative_asset_jobs")
    .select("id, campaign_draft_id, channel, generation_status")
    .eq("campaign_draft_id", campaignId)
    .eq("generation_status", "approved");

  if (jobError) {
    throw new Error(
      jobError.message || "failed to load placement creative jobs",
    );
  }

  const jobs = Array.isArray(jobRows) ? jobRows : [];
  const jobMap = new Map(
    jobs.map((row) => {
      const value = row as Record<string, unknown>;
      return [
        readString(value.id),
        {
          campaignDraftId: readString(value.campaign_draft_id),
          channel: readString(value.channel) as PublishChannel,
        },
      ];
    }),
  );

  const jobIds = Array.from(jobMap.keys()).filter(Boolean);
  if (!jobIds.length) return [];

  const { data: assetRows, error: assetError } = await admin
    .from("creative_assets")
    .select(
      "id, creative_asset_job_id, asset_role, parent_asset_id, variant_label, format, target_channel, target_width, target_height, adaptation_method, channel_suitability, storage_path, provider_metadata, updated_at",
    )
    .in("creative_asset_job_id", jobIds)
    .eq("status", "approved")
    .eq("is_current", true)
    .order("updated_at", { ascending: false });

  if (assetError) {
    throw new Error(
      assetError.message || "failed to load placement creative assets",
    );
  }

  return Promise.all(
    (Array.isArray(assetRows) ? assetRows : []).map(async (row) => {
      const value = row as Record<string, unknown>;
      const job = jobMap.get(readString(value.creative_asset_job_id));
      return {
        id: readString(value.id),
        creativeAssetJobId: readString(value.creative_asset_job_id),
        role: (readString(value.asset_role) === "derivative"
          ? "derivative"
          : "master") as "master" | "derivative",
        parentAssetId: readNullableString(value.parent_asset_id),
        variantLabel: readString(value.variant_label),
        format: readString(value.format) as CreativeAssetFormat,
        targetChannel: readNullableString(
          value.target_channel,
        ) as PublishChannel | null,
        width: readNumber(value.target_width),
        height: readNumber(value.target_height),
        adaptationMethod: readNullableString(value.adaptation_method),
        channelSuitability: readStringArray(
          value.channel_suitability,
        ) as PublishChannel[],
        storagePath: readString(value.storage_path),
        providerMetadata: readRecord(value.provider_metadata),
        updatedAt: readString(value.updated_at),
        jobChannel: job?.channel || "meta",
        previewUrl: await createCreativeAssetSignedUrl({
          admin,
          path: readString(value.storage_path),
        }),
      } satisfies PlacementCandidate;
    }),
  );
}

function toPlacementAssetView(
  candidate: PlacementCandidate,
): PlacementAssetView {
  return {
    id: candidate.id,
    role: candidate.role,
    variantLabel: candidate.variantLabel,
    format: candidate.format,
    targetChannel: candidate.targetChannel,
    width: candidate.width,
    height: candidate.height,
    adaptationMethod: candidate.adaptationMethod,
    channelSuitability: candidate.channelSuitability,
    storagePath: candidate.storagePath,
    providerMetadata: candidate.providerMetadata,
    updatedAt: candidate.updatedAt,
    previewUrl: candidate.previewUrl,
  };
}

function candidateSupportsChannel(
  candidate: PlacementCandidate,
  channel: PublishChannel,
) {
  return (
    candidate.targetChannel === channel ||
    candidate.channelSuitability.includes(channel) ||
    candidate.jobChannel === channel
  );
}

function isExactCandidate(
  candidate: PlacementCandidate,
  placement: CreativePlacementDefinition,
) {
  return candidate.format === placement.requiredFormat;
}

function isFallbackCandidate(
  candidate: PlacementCandidate,
  placement: CreativePlacementDefinition,
) {
  return placement.acceptableFormats.includes(candidate.format);
}

function candidateScore(
  candidate: PlacementCandidate,
  placement: CreativePlacementDefinition,
) {
  let score = 0;
  if (candidate.role === "derivative" && isExactCandidate(candidate, placement))
    score += 200;
  else if (
    candidate.role === "master" &&
    isExactCandidate(candidate, placement)
  )
    score += 180;
  else if (
    candidate.role === "derivative" &&
    isFallbackCandidate(candidate, placement)
  )
    score += 130;
  else if (
    candidate.role === "master" &&
    isFallbackCandidate(candidate, placement)
  )
    score += 110;

  if (candidate.targetChannel === placement.channel) score += 10;
  if (candidate.channelSuitability.includes(placement.channel)) score += 6;
  if (candidate.jobChannel === placement.channel) score += 4;
  score += Date.parse(candidate.updatedAt || "") || 0;

  return score;
}

function chooseBestCandidate(
  candidates: PlacementCandidate[],
  placement: CreativePlacementDefinition,
) {
  return (
    [...candidates].sort(
      (left, right) =>
        candidateScore(right, placement) - candidateScore(left, placement),
    )[0] || null
  );
}

function resolvePlacementReport(args: {
  placement: CreativePlacementDefinition;
  bundle: CampaignCreativeBundleView | null;
  candidates: PlacementCandidate[];
}): PlacementReadinessReport {
  const { placement, bundle } = args;
  const bundleSelected = bundle?.selected_asset
    ? ({
        id: bundle.selected_asset.id,
        creativeAssetJobId: bundle.selected_asset.creative_asset_job_id,
        role: bundle.selected_asset.asset_role,
        parentAssetId: bundle.selected_asset.parent_asset_id,
        variantLabel: bundle.selected_asset.variant_label,
        format: bundle.selected_asset.format,
        targetChannel: bundle.selected_asset.target_channel,
        width: bundle.selected_asset.target_width,
        height: bundle.selected_asset.target_height,
        adaptationMethod: bundle.selected_asset.adaptation_method,
        channelSuitability: bundle.selected_asset.channel_suitability,
        storagePath: bundle.selected_asset.storage_path,
        providerMetadata: bundle.selected_asset.provider_metadata as Record<
          string,
          unknown
        > | null,
        updatedAt: bundle.selected_asset.updated_at,
        jobChannel: placement.channel,
        previewUrl: bundle.selected_asset.preview_url,
      } satisfies PlacementCandidate)
    : null;
  const channelCandidates = args.candidates.filter((candidate) =>
    candidateSupportsChannel(candidate, placement.channel),
  );
  const exactCandidates = channelCandidates.filter((candidate) =>
    isExactCandidate(candidate, placement),
  );
  const fallbackCandidates = channelCandidates.filter((candidate) =>
    isFallbackCandidate(candidate, placement),
  );
  const warnings = [...placement.notes];
  const missing: string[] = [];

  const exactBundleCandidate =
    bundleSelected && isExactCandidate(bundleSelected, placement)
      ? bundleSelected
      : null;
  const fallbackBundleCandidate =
    bundleSelected && isFallbackCandidate(bundleSelected, placement)
      ? bundleSelected
      : null;
  const exactInferred = chooseBestCandidate(exactCandidates, placement);
  const fallbackInferred = chooseBestCandidate(fallbackCandidates, placement);

  if (
    bundle?.selection_source === "manual" &&
    (exactBundleCandidate ||
      (placement.allowFallback && fallbackBundleCandidate))
  ) {
    const selected = exactBundleCandidate || fallbackBundleCandidate;
    if (!exactBundleCandidate && fallbackBundleCandidate) {
      warnings.push(
        `${placement.label} is relying on the manually selected fallback asset.`,
      );
    }
    return {
      placementId: placement.id,
      placementLabel: placement.label,
      handoffName: placement.handoffName,
      channel: placement.channel,
      requiredFormat: placement.requiredFormat,
      preferredDimensions: placement.preferredDimensions,
      state: "manual_override",
      isBlocked: false,
      isExact: Boolean(exactBundleCandidate),
      acceptsFallback: placement.allowFallback,
      selectionSource: "manual_override",
      selectedFromBundle: true,
      selectedAsset: selected ? toPlacementAssetView(selected) : null,
      notes: placement.notes,
      warnings,
      missing,
      summary: `Manual channel override is resolving ${placement.label}.`,
    };
  }

  if (exactBundleCandidate) {
    return {
      placementId: placement.id,
      placementLabel: placement.label,
      handoffName: placement.handoffName,
      channel: placement.channel,
      requiredFormat: placement.requiredFormat,
      preferredDimensions: placement.preferredDimensions,
      state: "ready_exact",
      isBlocked: false,
      isExact: true,
      acceptsFallback: placement.allowFallback,
      selectionSource: "channel_bundle",
      selectedFromBundle: true,
      selectedAsset: toPlacementAssetView(exactBundleCandidate),
      notes: placement.notes,
      warnings,
      missing,
      summary: `${placement.label} is covered exactly by the selected channel bundle asset.`,
    };
  }

  if (exactInferred) {
    return {
      placementId: placement.id,
      placementLabel: placement.label,
      handoffName: placement.handoffName,
      channel: placement.channel,
      requiredFormat: placement.requiredFormat,
      preferredDimensions: placement.preferredDimensions,
      state: "ready_exact",
      isBlocked: false,
      isExact: true,
      acceptsFallback: placement.allowFallback,
      selectionSource: "placement_inferred",
      selectedFromBundle: false,
      selectedAsset: toPlacementAssetView(exactInferred),
      notes: placement.notes,
      warnings,
      missing,
      summary: `${placement.label} is covered by an approved exact creative.`,
    };
  }

  if (placement.allowFallback && fallbackBundleCandidate) {
    warnings.push(
      `${placement.label} is using the current channel bundle asset as a fallback.`,
    );
    return {
      placementId: placement.id,
      placementLabel: placement.label,
      handoffName: placement.handoffName,
      channel: placement.channel,
      requiredFormat: placement.requiredFormat,
      preferredDimensions: placement.preferredDimensions,
      state: "ready_fallback",
      isBlocked: false,
      isExact: false,
      acceptsFallback: placement.allowFallback,
      selectionSource: "channel_bundle",
      selectedFromBundle: true,
      selectedAsset: toPlacementAssetView(fallbackBundleCandidate),
      notes: placement.notes,
      warnings,
      missing,
      summary: `${placement.label} is ready on fallback coverage from the selected channel bundle asset.`,
    };
  }

  if (placement.allowFallback && fallbackInferred) {
    warnings.push(
      `${placement.label} is using an approved fallback creative instead of the preferred exact format.`,
    );
    return {
      placementId: placement.id,
      placementLabel: placement.label,
      handoffName: placement.handoffName,
      channel: placement.channel,
      requiredFormat: placement.requiredFormat,
      preferredDimensions: placement.preferredDimensions,
      state: "ready_fallback",
      isBlocked: false,
      isExact: false,
      acceptsFallback: placement.allowFallback,
      selectionSource: "placement_fallback",
      selectedFromBundle: false,
      selectedAsset: toPlacementAssetView(fallbackInferred),
      notes: placement.notes,
      warnings,
      missing,
      summary: `${placement.label} is ready on fallback coverage.`,
    };
  }

  const blockedCandidate = fallbackBundleCandidate || fallbackInferred;
  if (blockedCandidate) {
    missing.push(
      `${placement.label} still needs exact ${placement.requiredFormat} coverage.`,
    );
    return {
      placementId: placement.id,
      placementLabel: placement.label,
      handoffName: placement.handoffName,
      channel: placement.channel,
      requiredFormat: placement.requiredFormat,
      preferredDimensions: placement.preferredDimensions,
      state: placement.blockOnFallback ? "blocked" : "partial",
      isBlocked: placement.blockOnFallback,
      isExact: false,
      acceptsFallback: placement.allowFallback,
      selectionSource:
        blockedCandidate.id === fallbackBundleCandidate?.id
          ? "channel_bundle"
          : "placement_fallback",
      selectedFromBundle: blockedCandidate.id === fallbackBundleCandidate?.id,
      selectedAsset: toPlacementAssetView(blockedCandidate),
      notes: placement.notes,
      warnings,
      missing,
      summary: placement.blockOnFallback
        ? `${placement.label} is blocked until an exact creative is approved.`
        : `${placement.label} only has partial coverage.`,
    };
  }

  missing.push(
    `No approved creative is currently available for ${placement.label}.`,
  );
  return {
    placementId: placement.id,
    placementLabel: placement.label,
    handoffName: placement.handoffName,
    channel: placement.channel,
    requiredFormat: placement.requiredFormat,
    preferredDimensions: placement.preferredDimensions,
    state: placement.blockOnMissing ? "missing" : "partial",
    isBlocked: placement.blockOnMissing,
    isExact: false,
    acceptsFallback: placement.allowFallback,
    selectionSource: "missing",
    selectedFromBundle: false,
    selectedAsset: null,
    notes: placement.notes,
    warnings,
    missing,
    summary: `${placement.label} is missing approved coverage.`,
  };
}

export async function buildChannelPlacementCoverage(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  bundle: CampaignCreativeBundleView | null;
}) {
  const placementDefs = getCreativePlacementsForChannel(args.channel);
  const candidates = await listApprovedPlacementCandidates(
    args.admin,
    args.campaignId,
  );
  const placements = placementDefs.map((placement) =>
    resolvePlacementReport({
      placement,
      bundle: args.bundle,
      candidates,
    }),
  );
  const exactCount = placements.filter(
    (item) => item.state === "ready_exact",
  ).length;
  const fallbackCount = placements.filter(
    (item) => item.state === "ready_fallback",
  ).length;
  const manualOverrideCount = placements.filter(
    (item) => item.state === "manual_override",
  ).length;
  const blockedCount = placements.filter(
    (item) => item.state === "blocked",
  ).length;
  const missingCount = placements.filter(
    (item) => item.state === "missing",
  ).length;
  const overallState: PlacementReadinessState = blockedCount
    ? "blocked"
    : missingCount
      ? "missing"
      : manualOverrideCount
        ? "manual_override"
        : fallbackCount
          ? "ready_fallback"
          : "ready_exact";

  const summary = blockedCount
    ? `${blockedCount} placement${blockedCount === 1 ? "" : "s"} blocked for ${args.channel}.`
    : missingCount
      ? `${missingCount} placement${missingCount === 1 ? "" : "s"} still missing for ${args.channel}.`
      : fallbackCount
        ? `${fallbackCount} placement${fallbackCount === 1 ? "" : "s"} rely on fallback coverage for ${args.channel}.`
        : "All placements have exact or manually approved coverage.";

  return {
    channel: args.channel,
    placements,
    exactCount,
    fallbackCount,
    manualOverrideCount,
    blockedCount,
    missingCount,
    overallState,
    summary,
  } satisfies ChannelPlacementCoverageSummary;
}

export async function buildCampaignPlacementCoverage(args: {
  admin: AdminSupabase;
  campaignId: string;
  channels: PublishChannel[];
  bundles: CampaignCreativeBundleView[];
}) {
  const bundleByChannel = new Map(
    args.bundles.map((bundle) => [bundle.channel, bundle]),
  );
  const channels = await Promise.all(
    args.channels.map((channel) =>
      buildChannelPlacementCoverage({
        admin: args.admin,
        campaignId: args.campaignId,
        channel,
        bundle: bundleByChannel.get(channel) || null,
      }),
    ),
  );

  const exactCount = channels.reduce(
    (sum, channel) => sum + channel.exactCount,
    0,
  );
  const fallbackCount = channels.reduce(
    (sum, channel) => sum + channel.fallbackCount,
    0,
  );
  const manualOverrideCount = channels.reduce(
    (sum, channel) => sum + channel.manualOverrideCount,
    0,
  );
  const blockedCount = channels.reduce(
    (sum, channel) => sum + channel.blockedCount,
    0,
  );
  const missingCount = channels.reduce(
    (sum, channel) => sum + channel.missingCount,
    0,
  );

  const overallState: PlacementReadinessState = blockedCount
    ? "blocked"
    : missingCount
      ? "missing"
      : manualOverrideCount
        ? "manual_override"
        : fallbackCount
          ? "ready_fallback"
          : "ready_exact";

  const summary = blockedCount
    ? `${blockedCount} placement${blockedCount === 1 ? "" : "s"} blocked across paid/export handoff.`
    : missingCount
      ? `${missingCount} placement${missingCount === 1 ? "" : "s"} still missing across paid/export handoff.`
      : fallbackCount
        ? `${fallbackCount} placement${fallbackCount === 1 ? "" : "s"} rely on fallback coverage.`
        : "All configured placements have exact or manually approved coverage.";

  return {
    campaignId: args.campaignId,
    channels,
    exactCount,
    fallbackCount,
    manualOverrideCount,
    blockedCount,
    missingCount,
    overallState,
    summary,
  } satisfies CampaignPlacementCoverageSummary;
}
