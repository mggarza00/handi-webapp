import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CampaignGoal,
  ProviderGenerationMode,
  ProviderName,
} from "@/lib/ai/schemas";
import type { Database } from "@/types/supabase";
import { buildCampaignAttributionMapping } from "@/lib/analytics/campaign-attribution";
import type { TrackingContract } from "@/lib/analytics/schemas";
import { getCampaignDetail } from "@/lib/campaigns/repository";
import { selectPublishMessage } from "@/lib/campaigns/publish";
import { labelChannel, type PublishChannel } from "@/lib/campaigns/workflow";
import {
  buildCreativeBundlePayload,
  listCampaignCreativeBundles,
} from "@/lib/creative/bundles";
import type { CampaignCreativeBundleView } from "@/lib/creative/workflow";
import {
  buildCampaignPlacementCoverage,
  getCreativePlacementDefinition,
  type CampaignPlacementCoverageSummary,
  type ChannelPlacementCoverageSummary,
  type CreativePlacementId,
  type PlacementReadinessReport,
} from "@/lib/creative/placements";
import {
  evaluateCampaignVisualReadiness,
  evaluateChannelVisualReadiness,
  type CampaignVisualReadinessSummary,
  type ChannelVisualReadinessReport,
} from "@/lib/creative/readiness";
import {
  getPublishableChannels,
  getPublishConnector,
} from "@/lib/publish/index";

type AdminSupabase = SupabaseClient<Database>;

export type PlacementCreativeExportPackage = {
  type: "placement_export_package";
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  channel: PublishChannel;
  placementId: CreativePlacementId;
  placementLabel: string;
  handoffName: string;
  suggestedFilenames: {
    json: string;
    asset: string | null;
  };
  campaign: {
    audience: string;
    goal: string;
    serviceCategory: string;
    offer: string;
    cta: string;
    recommendedAngle: string;
    rationaleSummary: string;
  };
  copy: {
    messageId: string | null;
    variantName: string | null;
    headline: string | null;
    body: string | null;
    cta: string | null;
    rationaleSummary: string | null;
    qaScore: number | null;
    inheritedFromChannel: boolean;
  };
  placementReadiness: PlacementReadinessReport;
  creativeBundle: ReturnType<typeof buildCreativeBundlePayload>;
  provider: {
    copyProvider: string | null;
    visualProvider: string | null;
    visualModel: string | null;
  };
  tracking: TrackingContract;
  notes: string[];
};

export type ChannelCreativeExportPackage = {
  type: "channel_export_package";
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  channel: PublishChannel;
  connector: {
    channel: PublishChannel;
    label: string;
    capability: string;
    supportedModes: string[];
    defaultMode: string;
  } | null;
  suggestedFilenames: {
    json: string;
    asset: string | null;
  };
  campaign: {
    audience: string;
    goal: string;
    serviceCategory: string;
    offer: string;
    cta: string;
    recommendedAngle: string;
    rationaleSummary: string;
  };
  copy: {
    messageId: string | null;
    variantName: string | null;
    headline: string | null;
    body: string | null;
    cta: string | null;
    rationaleSummary: string | null;
    qaScore: number | null;
  };
  visualReadiness: ChannelVisualReadinessReport;
  placementCoverage: ChannelPlacementCoverageSummary;
  creativeBundle: ReturnType<typeof buildCreativeBundlePayload>;
  provider: {
    copyProvider: string | null;
    visualProvider: string | null;
    visualModel: string | null;
  };
  tracking: TrackingContract;
  placements: PlacementCreativeExportPackage[];
  notes: string[];
};

export type CampaignCreativeExportPackage = {
  type: "campaign_export_package";
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  summary: {
    audience: string;
    goal: string;
    channels: PublishChannel[];
    serviceCategory: string;
    offer: string;
    cta: string;
    recommendedAngle: string;
  };
  visualReadiness: CampaignVisualReadinessSummary;
  placementCoverage: CampaignPlacementCoverageSummary;
  channels: ChannelCreativeExportPackage[];
};

type ExportContext = {
  detail: NonNullable<Awaited<ReturnType<typeof getCampaignDetail>>>;
  creativeBundles: CampaignCreativeBundleView[];
  publishableChannels: PublishChannel[];
  bundleByChannel: Map<PublishChannel, CampaignCreativeBundleView>;
  placementCoverage: CampaignPlacementCoverageSummary;
};

export function sanitizeCreativeExportFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildCreativePackageFileNames(args: {
  title: string;
  channel: PublishChannel;
  assetVariantLabel?: string | null;
  assetExtension?: string | null;
  placementName?: string | null;
}) {
  const campaignSlug = sanitizeCreativeExportFilePart(args.title || "campaign");
  const channelSlug = sanitizeCreativeExportFilePart(args.channel);
  const visualSlug = sanitizeCreativeExportFilePart(
    args.assetVariantLabel || "creative",
  );
  const placementSlug = args.placementName
    ? `-${sanitizeCreativeExportFilePart(args.placementName)}`
    : "";
  const json = `${campaignSlug}-${channelSlug}${placementSlug}-handoff.json`;
  const asset = args.assetExtension
    ? `${campaignSlug}-${channelSlug}${placementSlug}-${visualSlug}.${args.assetExtension}`
    : null;
  return { json, asset };
}

export function extensionFromCreativeStoragePath(
  path: string | null | undefined,
) {
  if (!path) return null;
  const parts = path.split(".");
  return parts.length > 1 ? parts.at(-1) || null : null;
}

async function loadExportContext(args: {
  admin: AdminSupabase;
  campaignId: string;
}): Promise<ExportContext> {
  const [detail, creativeBundles] = await Promise.all([
    getCampaignDetail(args.admin, args.campaignId),
    listCampaignCreativeBundles(args.admin, args.campaignId),
  ]);

  if (!detail) {
    throw new Error("campaign not found");
  }

  const publishableChannels = getPublishableChannels(detail.draft.channels).map(
    (connector) => connector.channel,
  );
  const bundleByChannel = new Map(
    creativeBundles.map((bundle) => [bundle.channel, bundle]),
  );
  const placementCoverage = await buildCampaignPlacementCoverage({
    admin: args.admin,
    campaignId: detail.draft.id,
    channels: publishableChannels,
    bundles: creativeBundles,
  });

  return {
    detail,
    creativeBundles,
    publishableChannels,
    bundleByChannel,
    placementCoverage,
  };
}

function getMessageForChannel(context: ExportContext, channel: PublishChannel) {
  return selectPublishMessage({
    channel,
    messages: context.detail.messages,
    decisions: context.detail.variantDecisions,
  });
}

function buildBaseTracking(args: {
  campaignId: string;
  campaignTitle: string;
  goal: CampaignGoal;
  channel: PublishChannel;
  placementId?: string | null;
  messageId?: string | null;
  variantName?: string | null;
  creativeAssetId?: string | null;
  derivativeAssetId?: string | null;
  bundleStatus?: string | null;
  readinessStatus?: string | null;
  providerName?: ProviderName | null;
  providerMode?: ProviderGenerationMode | null;
  serviceCategory?: string | null;
}) {
  return buildCampaignAttributionMapping({
    campaignId: args.campaignId,
    campaignTitle: args.campaignTitle,
    goal: args.goal,
    channel: args.channel,
    placementId: args.placementId,
    messageId: args.messageId,
    variantName: args.variantName,
    creativeAssetId: args.creativeAssetId,
    derivativeAssetId: args.derivativeAssetId,
    bundleStatus: args.bundleStatus,
    readinessStatus: args.readinessStatus,
    providerName: args.providerName,
    providerMode: args.providerMode,
    serviceCategory: args.serviceCategory,
  });
}

function buildChannelPackageNotes(args: {
  channel: PublishChannel;
  visualReadiness: ChannelVisualReadinessReport;
  connectorLabel: string | null;
}) {
  return [
    `Channel: ${labelChannel(args.channel)}`,
    args.visualReadiness.summary,
    args.connectorLabel
      ? `${args.connectorLabel} package is prepared for manual/export handoff in this phase.`
      : "No connector metadata available.",
  ];
}

function getChannelPlacementCoverage(
  context: ExportContext,
  channel: PublishChannel,
) {
  return (
    context.placementCoverage.channels.find(
      (item) => item.channel === channel,
    ) || null
  );
}

function buildPlacementCreativeExportPackageFromContext(args: {
  context: ExportContext;
  channel: PublishChannel;
  bundle: CampaignCreativeBundleView | null;
  placement: PlacementReadinessReport;
}): PlacementCreativeExportPackage {
  const { context, channel, bundle, placement } = args;
  const message = getMessageForChannel(context, channel);
  const creativePayload = buildCreativeBundlePayload(bundle);
  const fileNames = buildCreativePackageFileNames({
    title: context.detail.draft.title,
    channel,
    placementName: placement.handoffName,
    assetVariantLabel: placement.selectedAsset?.variantLabel || null,
    assetExtension: extensionFromCreativeStoragePath(
      placement.selectedAsset?.storagePath,
    ),
  });

  return {
    type: "placement_export_package",
    generatedAt: new Date().toISOString(),
    campaignId: context.detail.draft.id,
    campaignTitle: context.detail.draft.title,
    channel,
    placementId: placement.placementId,
    placementLabel: placement.placementLabel,
    handoffName: placement.handoffName,
    suggestedFilenames: fileNames,
    campaign: {
      audience: context.detail.draft.audience,
      goal: context.detail.draft.goal,
      serviceCategory: context.detail.draft.service_category,
      offer: context.detail.draft.offer,
      cta: context.detail.draft.cta,
      recommendedAngle: context.detail.draft.recommended_angle,
      rationaleSummary: context.detail.draft.rationale_summary,
    },
    copy: {
      messageId: message?.id || null,
      variantName: message?.variant_name || null,
      headline: message?.content.headline || null,
      body: message?.content.body || null,
      cta: message?.content.cta || null,
      rationaleSummary: message?.rationale_parts.summary || null,
      qaScore: message?.qa_report.overall_score || null,
      inheritedFromChannel: true,
    },
    placementReadiness: placement,
    creativeBundle: creativePayload,
    provider: {
      copyProvider: message?.provider_metadata.providerName || null,
      visualProvider:
        (placement.selectedAsset?.providerMetadata?.providerName as
          | string
          | null) ||
        bundle?.selected_asset?.provider_metadata?.providerName ||
        null,
      visualModel:
        (placement.selectedAsset?.providerMetadata?.model as string | null) ||
        bundle?.selected_asset?.provider_metadata?.model ||
        null,
    },
    tracking: buildBaseTracking({
      campaignId: context.detail.draft.id,
      campaignTitle: context.detail.draft.title,
      goal: context.detail.draft.goal,
      channel,
      placementId: placement.placementId,
      messageId: message?.id || null,
      variantName: message?.variant_name || null,
      creativeAssetId: placement.selectedAsset?.id || null,
      derivativeAssetId:
        placement.selectedAsset?.role === "derivative"
          ? placement.selectedAsset.id
          : null,
      bundleStatus: bundle?.suitability_status || null,
      readinessStatus: placement.state,
      providerName:
        (placement.selectedAsset?.providerMetadata
          ?.providerName as ProviderName | null) ||
        (message?.provider_metadata.providerName as ProviderName | null) ||
        null,
      providerMode:
        (placement.selectedAsset?.providerMetadata
          ?.generationMode as ProviderGenerationMode | null) ||
        (message?.provider_metadata
          .generationMode as ProviderGenerationMode | null) ||
        null,
      serviceCategory: context.detail.draft.service_category,
    }),
    notes: [
      ...placement.notes,
      ...placement.warnings,
      ...placement.missing,
      placement.summary,
      `Placement handoff: ${getCreativePlacementDefinition(placement.placementId).handoffName}`,
      "Copy inherits the channel-level selected variant until per-placement copy divergence exists.",
    ],
  };
}

export async function buildPlacementCreativeExportPackage(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
  placementId: CreativePlacementId;
}): Promise<PlacementCreativeExportPackage> {
  const context = await loadExportContext({
    admin: args.admin,
    campaignId: args.campaignId,
  });
  const bundle = context.bundleByChannel.get(args.channel) || null;
  const placementCoverage = getChannelPlacementCoverage(context, args.channel);
  const placement = placementCoverage?.placements.find(
    (item) => item.placementId === args.placementId,
  );

  if (!placement) {
    throw new Error("placement not found for channel");
  }

  return buildPlacementCreativeExportPackageFromContext({
    context,
    channel: args.channel,
    bundle,
    placement,
  });
}

function buildChannelCreativeExportPackageFromContext(args: {
  context: ExportContext;
  channel: PublishChannel;
}): ChannelCreativeExportPackage {
  const { context, channel } = args;
  const bundle = context.bundleByChannel.get(channel) || null;
  const placementCoverage = getChannelPlacementCoverage(context, channel);

  if (!placementCoverage) {
    throw new Error("placement coverage not available for channel");
  }

  const visualReadiness = evaluateChannelVisualReadiness({
    channel,
    bundle,
  });
  const message = getMessageForChannel(context, channel);
  const connector = getPublishConnector(channel);
  const creativePayload = buildCreativeBundlePayload(bundle);
  const fileNames = buildCreativePackageFileNames({
    title: context.detail.draft.title,
    channel,
    assetVariantLabel: bundle?.selected_asset?.variant_label || null,
    assetExtension: extensionFromCreativeStoragePath(
      bundle?.selected_asset?.storage_path,
    ),
  });
  const placements = placementCoverage.placements.map((placement) =>
    buildPlacementCreativeExportPackageFromContext({
      context,
      channel,
      bundle,
      placement,
    }),
  );

  return {
    type: "channel_export_package",
    generatedAt: new Date().toISOString(),
    campaignId: context.detail.draft.id,
    campaignTitle: context.detail.draft.title,
    channel,
    connector: connector
      ? {
          channel: connector.channel,
          label: connector.label,
          capability: connector.capability,
          supportedModes: connector.supportedModes,
          defaultMode: connector.defaultMode,
        }
      : null,
    suggestedFilenames: fileNames,
    campaign: {
      audience: context.detail.draft.audience,
      goal: context.detail.draft.goal,
      serviceCategory: context.detail.draft.service_category,
      offer: context.detail.draft.offer,
      cta: context.detail.draft.cta,
      recommendedAngle: context.detail.draft.recommended_angle,
      rationaleSummary: context.detail.draft.rationale_summary,
    },
    copy: {
      messageId: message?.id || null,
      variantName: message?.variant_name || null,
      headline: message?.content.headline || null,
      body: message?.content.body || null,
      cta: message?.content.cta || null,
      rationaleSummary: message?.rationale_parts.summary || null,
      qaScore: message?.qa_report.overall_score || null,
    },
    visualReadiness,
    placementCoverage,
    creativeBundle: creativePayload,
    provider: {
      copyProvider: message?.provider_metadata.providerName || null,
      visualProvider:
        bundle?.selected_asset?.provider_metadata?.providerName || null,
      visualModel: bundle?.selected_asset?.provider_metadata?.model || null,
    },
    tracking: buildBaseTracking({
      campaignId: context.detail.draft.id,
      campaignTitle: context.detail.draft.title,
      goal: context.detail.draft.goal,
      channel,
      messageId: message?.id || null,
      variantName: message?.variant_name || null,
      creativeAssetId: bundle?.selected_asset?.id || null,
      derivativeAssetId:
        bundle?.selected_asset?.asset_role === "derivative"
          ? bundle.selected_asset.id
          : null,
      bundleStatus: bundle?.suitability_status || null,
      readinessStatus: visualReadiness.state,
      providerName:
        (bundle?.selected_asset?.provider_metadata
          ?.providerName as ProviderName | null) ||
        (message?.provider_metadata.providerName as ProviderName | null) ||
        null,
      providerMode:
        (bundle?.selected_asset?.provider_metadata
          ?.generationMode as ProviderGenerationMode | null) ||
        (message?.provider_metadata
          .generationMode as ProviderGenerationMode | null) ||
        null,
      serviceCategory: context.detail.draft.service_category,
    }),
    placements,
    notes: [
      ...buildChannelPackageNotes({
        channel,
        visualReadiness,
        connectorLabel: connector?.label || null,
      }),
      placementCoverage.summary,
    ],
  };
}

export async function buildChannelCreativeExportPackage(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PublishChannel;
}): Promise<ChannelCreativeExportPackage> {
  const context = await loadExportContext({
    admin: args.admin,
    campaignId: args.campaignId,
  });

  return buildChannelCreativeExportPackageFromContext({
    context,
    channel: args.channel,
  });
}

export async function buildCampaignCreativeExportPackage(args: {
  admin: AdminSupabase;
  campaignId: string;
}): Promise<CampaignCreativeExportPackage> {
  const context = await loadExportContext({
    admin: args.admin,
    campaignId: args.campaignId,
  });
  const visualReadiness = evaluateCampaignVisualReadiness({
    campaignId: context.detail.draft.id,
    channels: context.detail.draft.channels,
    bundles: context.creativeBundles,
  });
  const channels = context.publishableChannels.map((channel) =>
    buildChannelCreativeExportPackageFromContext({
      context,
      channel,
    }),
  );

  return {
    type: "campaign_export_package",
    generatedAt: new Date().toISOString(),
    campaignId: context.detail.draft.id,
    campaignTitle: context.detail.draft.title,
    summary: {
      audience: context.detail.draft.audience,
      goal: context.detail.draft.goal,
      channels: context.publishableChannels,
      serviceCategory: context.detail.draft.service_category,
      offer: context.detail.draft.offer,
      cta: context.detail.draft.cta,
      recommendedAngle: context.detail.draft.recommended_angle,
    },
    visualReadiness,
    placementCoverage: context.placementCoverage,
    channels,
  };
}
