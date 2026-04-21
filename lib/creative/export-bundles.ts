import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import {
  buildCampaignCreativeExportPackage,
  buildChannelCreativeExportPackage,
  buildCreativePackageFileNames,
  buildPlacementCreativeExportPackage,
  extensionFromCreativeStoragePath,
  sanitizeCreativeExportFilePart,
  type ChannelCreativeExportPackage,
  type PlacementCreativeExportPackage,
} from "@/lib/creative/export-packages";
import { downloadCreativeAssetBuffer } from "@/lib/creative/storage";

type AdminSupabase = SupabaseClient<Database>;

type ChannelBundleDownloadStatus =
  | "download_ready"
  | "download_warning"
  | "download_blocked";

export type ChannelCreativeDownloadEvaluation = {
  status: ChannelBundleDownloadStatus;
  warnings: string[];
  blockingReason: string | null;
};

export type PlacementCreativeDownloadBundle = {
  type: "placement_download_bundle";
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  channel: string;
  placementId: string;
  status: ChannelBundleDownloadStatus;
  warnings: string[];
  blockingReason: string | null;
  fileName: string;
  contentType: "application/zip";
  manifest: Record<string, unknown>;
  entries: string[];
  buffer: Buffer;
};

export type ChannelCreativeDownloadBundle = {
  type: "channel_download_bundle";
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  channel: string;
  status: ChannelBundleDownloadStatus;
  warnings: string[];
  blockingReason: string | null;
  fileName: string;
  contentType: "application/zip";
  manifest: Record<string, unknown>;
  entries: string[];
  buffer: Buffer;
};

export type CampaignCreativeDownloadBundle = {
  type: "campaign_download_bundle";
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  status: ChannelBundleDownloadStatus;
  warnings: string[];
  blockingReason: string | null;
  fileName: string;
  contentType: "application/zip";
  manifest: Record<string, unknown>;
  entries: string[];
  includedChannels: string[];
  blockedChannels: string[];
  buffer: Buffer;
};

function buildCopyPayload(
  pkg: ChannelCreativeExportPackage | PlacementCreativeExportPackage,
) {
  return {
    campaignId: pkg.campaignId,
    campaignTitle: pkg.campaignTitle,
    channel: pkg.channel,
    audience: pkg.campaign.audience,
    goal: pkg.campaign.goal,
    serviceCategory: pkg.campaign.serviceCategory,
    offer: pkg.campaign.offer,
    cta: pkg.campaign.cta,
    recommendedAngle: pkg.campaign.recommendedAngle,
    variantName: pkg.copy.variantName,
    headline: pkg.copy.headline,
    body: pkg.copy.body,
    selectedCta: pkg.copy.cta,
    rationaleSummary: pkg.copy.rationaleSummary,
    qaScore: pkg.copy.qaScore,
  };
}

function uniqueWarnings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  );
}

function evaluatePlacementBundleDownload(
  pkg: PlacementCreativeExportPackage,
): ChannelCreativeDownloadEvaluation {
  const warnings = uniqueWarnings([
    ...pkg.placementReadiness.warnings,
    ...pkg.placementReadiness.missing,
    ...pkg.notes,
  ]);
  const selectedAsset = pkg.placementReadiness.selectedAsset;

  if (
    !selectedAsset?.storagePath ||
    pkg.placementReadiness.state === "missing"
  ) {
    return {
      status: "download_blocked",
      warnings,
      blockingReason:
        "No approved visual asset is available for this placement, so the download bundle would be incomplete.",
    };
  }

  if (
    pkg.placementReadiness.state === "blocked" ||
    pkg.placementReadiness.state === "partial" ||
    pkg.placementReadiness.state === "ready_fallback" ||
    pkg.placementReadiness.state === "manual_override" ||
    !pkg.copy.messageId
  ) {
    const nextWarnings = [...warnings];
    if (pkg.placementReadiness.state === "blocked") {
      nextWarnings.push(
        "This placement is blocked for assisted publish/export, but the currently selected visual is still being packed for manual paid handoff.",
      );
    }
    if (!pkg.copy.messageId) {
      nextWarnings.push(
        "No copy variant is resolved yet. The bundle still includes campaign and placement metadata for manual completion.",
      );
    }
    return {
      status: "download_warning",
      warnings: uniqueWarnings(nextWarnings),
      blockingReason: null,
    };
  }

  return {
    status: "download_ready",
    warnings,
    blockingReason: null,
  };
}

function evaluateChannelBundleDownload(
  pkg: ChannelCreativeExportPackage,
): ChannelCreativeDownloadEvaluation {
  const baseWarnings = uniqueWarnings([
    ...pkg.visualReadiness.warnings,
    ...pkg.visualReadiness.missing,
    ...pkg.notes,
  ]);
  const selectedAsset = pkg.creativeBundle.selectedAsset;
  const placementEvaluations = pkg.placements.map((placement) => ({
    placement,
    evaluation: evaluatePlacementBundleDownload(placement),
  }));
  const readyPlacements = placementEvaluations.filter(
    (item) => item.evaluation.status !== "download_blocked",
  );
  const blockedPlacements = placementEvaluations.filter(
    (item) => item.evaluation.status === "download_blocked",
  );

  if (!selectedAsset?.storagePath && !readyPlacements.length) {
    return {
      status: "download_blocked",
      warnings: baseWarnings,
      blockingReason:
        "No approved channel asset or placement-ready asset is selected for this channel.",
    };
  }

  if (pkg.visualReadiness.state === "missing" && !readyPlacements.length) {
    return {
      status: "download_blocked",
      warnings: baseWarnings,
      blockingReason:
        "Visual readiness is missing for this channel and no placement can be exported honestly.",
    };
  }

  const warnings = uniqueWarnings([
    ...baseWarnings,
    ...placementEvaluations.flatMap((item) => item.evaluation.warnings),
    ...blockedPlacements.map(
      (item) =>
        `${item.placement.placementLabel}: ${item.evaluation.blockingReason || item.placement.placementReadiness.summary}`,
    ),
  ]);

  if (
    blockedPlacements.length ||
    pkg.visualReadiness.state === "blocked" ||
    pkg.visualReadiness.state === "partial" ||
    pkg.visualReadiness.state === "ready_fallback" ||
    pkg.visualReadiness.state === "manual_override" ||
    !pkg.copy.messageId
  ) {
    return {
      status: "download_warning",
      warnings,
      blockingReason: null,
    };
  }

  return {
    status: "download_ready",
    warnings,
    blockingReason: null,
  };
}

function buildPlacementBundleManifest(args: {
  pkg: PlacementCreativeExportPackage;
  evaluation: ChannelCreativeDownloadEvaluation;
  assetFileName: string | null;
}) {
  const selectedAsset = args.pkg.placementReadiness.selectedAsset;
  return {
    type: "placement_download_bundle_manifest",
    generated_at: args.pkg.generatedAt,
    campaign: {
      id: args.pkg.campaignId,
      title: args.pkg.campaignTitle,
      audience: args.pkg.campaign.audience,
      goal: args.pkg.campaign.goal,
      service_category: args.pkg.campaign.serviceCategory,
      offer: args.pkg.campaign.offer,
      cta: args.pkg.campaign.cta,
      recommended_angle: args.pkg.campaign.recommendedAngle,
      rationale_summary: args.pkg.campaign.rationaleSummary,
    },
    channel: args.pkg.channel,
    placement: {
      id: args.pkg.placementId,
      label: args.pkg.placementLabel,
      handoff_name: args.pkg.handoffName,
    },
    readiness: {
      status: args.pkg.placementReadiness.state,
      download_status: args.evaluation.status,
      blocking_reason: args.evaluation.blockingReason,
      summary: args.pkg.placementReadiness.summary,
      required_format: args.pkg.placementReadiness.requiredFormat,
      preferred_dimensions: args.pkg.placementReadiness.preferredDimensions,
      warnings: args.evaluation.warnings,
      missing: args.pkg.placementReadiness.missing,
    },
    copy: buildCopyPayload(args.pkg),
    creative_bundle: {
      suitability_status: args.pkg.creativeBundle.suitabilityStatus,
      selection_source: args.pkg.creativeBundle.selectionSource,
      notes: args.pkg.creativeBundle.notes,
      summary: args.pkg.creativeBundle.summary,
    },
    selected_asset: selectedAsset
      ? {
          id: selectedAsset.id,
          role: selectedAsset.role,
          variant_label: selectedAsset.variantLabel,
          format: selectedAsset.format,
          target_channel: selectedAsset.targetChannel,
          dimensions: {
            width: selectedAsset.width,
            height: selectedAsset.height,
          },
          adaptation_method: selectedAsset.adaptationMethod,
          provider_metadata: selectedAsset.providerMetadata,
          file_name: args.assetFileName,
        }
      : null,
    provider: args.pkg.provider,
    tracking: args.pkg.tracking,
    notes: args.pkg.notes,
  };
}

function buildChannelBundleManifest(args: {
  pkg: ChannelCreativeExportPackage;
  evaluation: ChannelCreativeDownloadEvaluation;
  assetFileName: string | null;
  placementManifests: Array<Record<string, unknown>>;
}) {
  const selectedAsset = args.pkg.creativeBundle.selectedAsset;
  return {
    type: "channel_download_bundle_manifest",
    generated_at: args.pkg.generatedAt,
    campaign: {
      id: args.pkg.campaignId,
      title: args.pkg.campaignTitle,
      audience: args.pkg.campaign.audience,
      goal: args.pkg.campaign.goal,
      service_category: args.pkg.campaign.serviceCategory,
      offer: args.pkg.campaign.offer,
      cta: args.pkg.campaign.cta,
      recommended_angle: args.pkg.campaign.recommendedAngle,
      rationale_summary: args.pkg.campaign.rationaleSummary,
    },
    channel: args.pkg.channel,
    connector: args.pkg.connector,
    readiness: {
      status: args.pkg.visualReadiness.state,
      download_status: args.evaluation.status,
      blocking_reason: args.evaluation.blockingReason,
      summary: args.pkg.visualReadiness.summary,
      required_format: args.pkg.visualReadiness.requiredFormat,
      warnings: args.evaluation.warnings,
      missing: args.pkg.visualReadiness.missing,
    },
    placement_coverage: {
      summary: args.pkg.placementCoverage.summary,
      overall_state: args.pkg.placementCoverage.overallState,
      exact_count: args.pkg.placementCoverage.exactCount,
      fallback_count: args.pkg.placementCoverage.fallbackCount,
      manual_override_count: args.pkg.placementCoverage.manualOverrideCount,
      blocked_count: args.pkg.placementCoverage.blockedCount,
      missing_count: args.pkg.placementCoverage.missingCount,
      placements: args.placementManifests,
    },
    copy: buildCopyPayload(args.pkg),
    creative_bundle: {
      suitability_status: args.pkg.creativeBundle.suitabilityStatus,
      selection_source: args.pkg.creativeBundle.selectionSource,
      notes: args.pkg.creativeBundle.notes,
      summary: args.pkg.creativeBundle.summary,
      selected_asset: selectedAsset
        ? {
            id: selectedAsset.id,
            role: selectedAsset.role,
            variant_label: selectedAsset.variantLabel,
            format: selectedAsset.format,
            target_channel: selectedAsset.targetChannel,
            dimensions: {
              width: selectedAsset.width,
              height: selectedAsset.height,
            },
            adaptation_method: selectedAsset.adaptationMethod,
            provider_metadata: selectedAsset.providerMetadata,
            file_name: args.assetFileName,
          }
        : null,
    },
    provider: args.pkg.provider,
    tracking: args.pkg.tracking,
    qa: {
      copy_score: args.pkg.copy.qaScore,
    },
    notes: args.pkg.notes,
  };
}

async function attachPlacementToZip(args: {
  admin: AdminSupabase;
  root: JSZip;
  pkg: PlacementCreativeExportPackage;
}) {
  const evaluation = evaluatePlacementBundleDownload(args.pkg);
  const placementFolder = args.root.folder(
    `placements/${args.pkg.placementReadiness.handoffName}`,
  );

  if (!placementFolder) {
    throw new Error("failed to initialize placement bundle folder");
  }

  let assetFileName: string | null = null;
  if (
    evaluation.status !== "download_blocked" &&
    args.pkg.placementReadiness.selectedAsset?.storagePath
  ) {
    const assetFolder = placementFolder.folder("assets");
    if (assetFolder) {
      assetFileName =
        args.pkg.suggestedFilenames.asset || "placement-creative-asset.bin";
      const assetBuffer = await downloadCreativeAssetBuffer({
        admin: args.admin,
        path: args.pkg.placementReadiness.selectedAsset.storagePath,
      });
      assetFolder.file(assetFileName, assetBuffer);
    }
  }

  const manifest = buildPlacementBundleManifest({
    pkg: args.pkg,
    evaluation,
    assetFileName,
  });

  placementFolder.file("manifest.json", JSON.stringify(manifest, null, 2));
  placementFolder.file(
    "copy.json",
    JSON.stringify(buildCopyPayload(args.pkg), null, 2),
  );

  return {
    evaluation,
    manifest,
  };
}

async function attachChannelToZip(args: {
  admin: AdminSupabase;
  root: JSZip;
  pkg: ChannelCreativeExportPackage;
  evaluation: ChannelCreativeDownloadEvaluation;
}) {
  let assetFileName: string | null = null;
  const selectedAsset = args.pkg.creativeBundle.selectedAsset;
  if (selectedAsset?.storagePath) {
    const assetFolder = args.root.folder("assets");
    if (assetFolder) {
      const assetExtension = extensionFromCreativeStoragePath(
        selectedAsset.storagePath,
      );
      const fileNames = buildCreativePackageFileNames({
        title: args.pkg.campaignTitle,
        channel: args.pkg.channel,
        assetVariantLabel: selectedAsset.variantLabel,
        assetExtension,
      });
      assetFileName = fileNames.asset || "creative-asset.bin";
      const assetBuffer = await downloadCreativeAssetBuffer({
        admin: args.admin,
        path: selectedAsset.storagePath,
      });
      assetFolder.file(assetFileName, assetBuffer);
    }
  }

  const placementManifests: Array<Record<string, unknown>> = [];
  for (const placement of args.pkg.placements) {
    const result = await attachPlacementToZip({
      admin: args.admin,
      root: args.root,
      pkg: placement,
    });
    placementManifests.push(result.manifest);
  }

  const manifest = buildChannelBundleManifest({
    pkg: args.pkg,
    evaluation: args.evaluation,
    assetFileName,
    placementManifests,
  });
  args.root.file("manifest.json", JSON.stringify(manifest, null, 2));
  args.root.file(
    "copy.json",
    JSON.stringify(buildCopyPayload(args.pkg), null, 2),
  );

  return manifest;
}

async function buildChannelZip(args: {
  admin: AdminSupabase;
  pkg: ChannelCreativeExportPackage;
  evaluation: ChannelCreativeDownloadEvaluation;
}) {
  const zip = new JSZip();
  const manifest = await attachChannelToZip({
    admin: args.admin,
    root: zip,
    pkg: args.pkg,
    evaluation: args.evaluation,
  });

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer,
    entries: Object.keys(zip.files).sort(),
    fileName: `${sanitizeCreativeExportFilePart(args.pkg.campaignTitle || "campaign")}-${sanitizeCreativeExportFilePart(args.pkg.channel)}-bundle.zip`,
    manifest,
  };
}

async function buildPlacementZip(args: {
  admin: AdminSupabase;
  pkg: PlacementCreativeExportPackage;
  evaluation: ChannelCreativeDownloadEvaluation;
}) {
  const zip = new JSZip();
  const manifest = buildPlacementBundleManifest({
    pkg: args.pkg,
    evaluation: args.evaluation,
    assetFileName: args.pkg.suggestedFilenames.asset,
  });
  const selectedAsset = args.pkg.placementReadiness.selectedAsset;

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("copy.json", JSON.stringify(buildCopyPayload(args.pkg), null, 2));

  if (
    args.evaluation.status !== "download_blocked" &&
    selectedAsset?.storagePath &&
    args.pkg.suggestedFilenames.asset
  ) {
    const assetFolder = zip.folder("assets");
    if (assetFolder) {
      const assetBuffer = await downloadCreativeAssetBuffer({
        admin: args.admin,
        path: selectedAsset.storagePath,
      });
      assetFolder.file(args.pkg.suggestedFilenames.asset, assetBuffer);
    }
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer,
    entries: Object.keys(zip.files).sort(),
    fileName: `${sanitizeCreativeExportFilePart(args.pkg.campaignTitle || "campaign")}-${sanitizeCreativeExportFilePart(args.pkg.channel)}-${sanitizeCreativeExportFilePart(args.pkg.handoffName)}-bundle.zip`,
    manifest,
  };
}

export async function buildPlacementCreativeDownloadBundle(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: string;
  placementId: string;
}): Promise<PlacementCreativeDownloadBundle> {
  const pkg = await buildPlacementCreativeExportPackage({
    admin: args.admin,
    campaignId: args.campaignId,
    channel: args.channel as never,
    placementId: args.placementId as never,
  });
  const evaluation = evaluatePlacementBundleDownload(pkg);

  if (evaluation.status === "download_blocked") {
    throw new Error(
      evaluation.blockingReason || "placement bundle download blocked",
    );
  }

  const zip = await buildPlacementZip({
    admin: args.admin,
    pkg,
    evaluation,
  });

  return {
    type: "placement_download_bundle",
    generatedAt: new Date().toISOString(),
    campaignId: pkg.campaignId,
    campaignTitle: pkg.campaignTitle,
    channel: pkg.channel,
    placementId: pkg.placementId,
    status: evaluation.status,
    warnings: evaluation.warnings,
    blockingReason: evaluation.blockingReason,
    fileName: zip.fileName,
    contentType: "application/zip",
    manifest: zip.manifest,
    entries: zip.entries,
    buffer: zip.buffer,
  };
}

export async function buildChannelCreativeDownloadBundle(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: string;
}): Promise<ChannelCreativeDownloadBundle> {
  const pkg = await buildChannelCreativeExportPackage({
    admin: args.admin,
    campaignId: args.campaignId,
    channel: args.channel as never,
  });
  const evaluation = evaluateChannelBundleDownload(pkg);

  if (evaluation.status === "download_blocked") {
    throw new Error(
      evaluation.blockingReason || "channel bundle download blocked",
    );
  }

  const zip = await buildChannelZip({
    admin: args.admin,
    pkg,
    evaluation,
  });

  return {
    type: "channel_download_bundle",
    generatedAt: new Date().toISOString(),
    campaignId: pkg.campaignId,
    campaignTitle: pkg.campaignTitle,
    channel: pkg.channel,
    status: evaluation.status,
    warnings: evaluation.warnings,
    blockingReason: evaluation.blockingReason,
    fileName: zip.fileName,
    contentType: "application/zip",
    manifest: zip.manifest,
    entries: zip.entries,
    buffer: zip.buffer,
  };
}

export async function buildCampaignCreativeDownloadBundle(args: {
  admin: AdminSupabase;
  campaignId: string;
}): Promise<CampaignCreativeDownloadBundle> {
  const pkg = await buildCampaignCreativeExportPackage({
    admin: args.admin,
    campaignId: args.campaignId,
  });

  const zip = new JSZip();
  const includedChannels: string[] = [];
  const blockedChannels: string[] = [];
  const warnings: string[] = [];
  const channelsManifest: Array<Record<string, unknown>> = [];

  for (const channelPackage of pkg.channels) {
    const evaluation = evaluateChannelBundleDownload(channelPackage);
    if (evaluation.status === "download_blocked") {
      blockedChannels.push(channelPackage.channel);
      warnings.push(
        `${channelPackage.channel}: ${evaluation.blockingReason || channelPackage.visualReadiness.summary}`,
      );
      channelsManifest.push({
        channel: channelPackage.channel,
        status: evaluation.status,
        blocking_reason: evaluation.blockingReason,
        warnings: evaluation.warnings,
        readiness: channelPackage.visualReadiness,
        placement_coverage: channelPackage.placementCoverage,
      });
      continue;
    }

    try {
      const folder = zip.folder(`channels/${channelPackage.channel}`);
      if (!folder) {
        throw new Error("failed to initialize channel bundle folder");
      }

      const manifest = await attachChannelToZip({
        admin: args.admin,
        root: folder,
        pkg: channelPackage,
        evaluation,
      });

      includedChannels.push(channelPackage.channel);
      warnings.push(
        ...evaluation.warnings.map(
          (warning) => `${channelPackage.channel}: ${warning}`,
        ),
      );
      channelsManifest.push({
        channel: channelPackage.channel,
        status: evaluation.status,
        warnings: evaluation.warnings,
        readiness: channelPackage.visualReadiness,
        placement_coverage: channelPackage.placementCoverage,
        manifest,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "selected visual could not be fetched from private storage";
      blockedChannels.push(channelPackage.channel);
      warnings.push(`${channelPackage.channel}: ${message}`);
      channelsManifest.push({
        channel: channelPackage.channel,
        status: "download_blocked",
        blocking_reason: message,
        warnings: [...evaluation.warnings, message],
        readiness: channelPackage.visualReadiness,
        placement_coverage: channelPackage.placementCoverage,
      });
    }
  }

  if (!includedChannels.length) {
    throw new Error(
      "No channel currently has enough approved visual coverage to generate a downloadable bundle.",
    );
  }

  const dedupedWarnings = uniqueWarnings(warnings);
  const status: ChannelBundleDownloadStatus = blockedChannels.length
    ? "download_warning"
    : dedupedWarnings.length
      ? "download_warning"
      : "download_ready";

  const manifest = {
    type: "campaign_download_bundle_manifest",
    generated_at: new Date().toISOString(),
    campaign: {
      id: pkg.campaignId,
      title: pkg.campaignTitle,
      audience: pkg.summary.audience,
      goal: pkg.summary.goal,
      service_category: pkg.summary.serviceCategory,
      offer: pkg.summary.offer,
      cta: pkg.summary.cta,
      recommended_angle: pkg.summary.recommendedAngle,
      channels: pkg.summary.channels,
    },
    visual_readiness: pkg.visualReadiness,
    placement_coverage: pkg.placementCoverage,
    included_channels: includedChannels,
    blocked_channels: blockedChannels,
    warnings: dedupedWarnings,
    channels: channelsManifest,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "campaign-summary.json",
    JSON.stringify(
      {
        campaignId: pkg.campaignId,
        campaignTitle: pkg.campaignTitle,
        summary: pkg.summary,
        generatedAt: pkg.generatedAt,
        placementCoverage: pkg.placementCoverage,
      },
      null,
      2,
    ),
  );

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    type: "campaign_download_bundle",
    generatedAt: new Date().toISOString(),
    campaignId: pkg.campaignId,
    campaignTitle: pkg.campaignTitle,
    status,
    warnings: dedupedWarnings,
    blockingReason: null,
    fileName: `${sanitizeCreativeExportFilePart(pkg.campaignTitle || "campaign")}-campaign-bundle.zip`,
    contentType: "application/zip",
    manifest,
    entries: Object.keys(zip.files).sort(),
    includedChannels,
    blockedChannels,
    buffer,
  };
}
