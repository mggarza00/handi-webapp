import type {
  ChannelCreativeExportPackage,
  PlacementCreativeExportPackage,
} from "@/lib/creative/export-packages";
import type {
  PaidChannelDraft,
  PaidPlacementDraft,
} from "@/lib/publish/drafts/index";

function buildGoogleAudienceNotes(pkg: PlacementCreativeExportPackage) {
  return [
    `Audience: ${pkg.campaign.audience}`,
    `Goal: ${pkg.campaign.goal}`,
    `Service category: ${pkg.campaign.serviceCategory}`,
    `Offer: ${pkg.campaign.offer}`,
  ];
}

export function buildGooglePlacementDraft(
  pkg: PlacementCreativeExportPackage,
): PaidPlacementDraft {
  return {
    type: "paid_placement_draft",
    platform: "google",
    generatedAt: pkg.generatedAt,
    campaignId: pkg.campaignId,
    campaignTitle: pkg.campaignTitle,
    channel: pkg.channel,
    placementId: pkg.placementId,
    placementLabel: pkg.placementLabel,
    handoffName: pkg.handoffName,
    naming: {
      recommendedFileStem: pkg.paidHandoff.recommendedFileStem,
      assetFileName: pkg.suggestedFilenames.asset,
      jsonFileName: pkg.suggestedFilenames.json,
    },
    campaign: pkg.campaign,
    readiness: {
      state: pkg.placementReadiness.state,
      blocked: pkg.placementReadiness.isBlocked,
      warnings: pkg.paidHandoff.warnings,
      summary: pkg.placementReadiness.summary,
    },
    handoff: pkg.paidHandoff,
    internalIds: {
      campaignId: pkg.campaignId,
      channel: pkg.channel,
      placementId: pkg.placementId,
      messageId: pkg.copy.baseMessageId,
      placementCopyId: pkg.copy.placementMessageId,
      creativeAssetId: pkg.placementReadiness.selectedAsset?.id || null,
      derivativeAssetId:
        pkg.placementReadiness.selectedAsset?.role === "derivative"
          ? pkg.placementReadiness.selectedAsset.id
          : null,
    },
    mediaBuyerNotes: [
      ...buildGoogleAudienceNotes(pkg),
      `Placement: ${pkg.paidHandoff.operationalName}`,
      `Copy source: ${pkg.paidHandoff.copy.sourceLabel}`,
      `Visual coverage: ${pkg.paidHandoff.visual.exact ? "Exact" : "Fallback"}`,
      ...pkg.paidHandoff.notes,
    ],
    tracking: pkg.tracking,
    payload: {
      campaign_name: pkg.campaignTitle,
      ad_group_notes: buildGoogleAudienceNotes(pkg),
      export_target: {
        id: pkg.placementId,
        label: pkg.placementLabel,
        operational_name: pkg.paidHandoff.operationalName,
      },
      ad: {
        headline: pkg.copy.headline,
        description: pkg.copy.body,
        cta: pkg.copy.cta,
      },
      asset: pkg.placementReadiness.selectedAsset
        ? {
            id: pkg.placementReadiness.selectedAsset.id,
            variant_label: pkg.placementReadiness.selectedAsset.variantLabel,
            format: pkg.placementReadiness.selectedAsset.format,
            width: pkg.placementReadiness.selectedAsset.width,
            height: pkg.placementReadiness.selectedAsset.height,
            role: pkg.placementReadiness.selectedAsset.role,
            filename: pkg.suggestedFilenames.asset,
          }
        : null,
      utm_tracking: pkg.tracking.utm,
      custom_tracking: pkg.tracking.identifiers,
      warnings: pkg.paidHandoff.warnings,
    },
  };
}

export function buildGoogleChannelDraft(
  pkg: ChannelCreativeExportPackage,
  placements: PaidPlacementDraft[],
): PaidChannelDraft {
  return {
    type: "paid_channel_draft",
    platform: "google",
    generatedAt: pkg.generatedAt,
    campaignId: pkg.campaignId,
    campaignTitle: pkg.campaignTitle,
    channel: pkg.channel,
    summary: {
      connectorLabel: pkg.connector?.label || "Google ads",
      placementCount: placements.length,
      readyPlacements: placements.filter(
        (placement) => !placement.readiness.blocked,
      ).length,
      warningPlacements: placements.filter(
        (placement) => placement.readiness.warnings.length,
      ).length,
      blockedPlacements: placements.filter(
        (placement) => placement.readiness.blocked,
      ).length,
    },
    campaign: pkg.campaign,
    placements,
    tracking: pkg.tracking,
    notes: ["Google paid draft export-only payload.", ...pkg.notes],
  };
}
