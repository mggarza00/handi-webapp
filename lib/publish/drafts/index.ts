import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ChannelCreativeExportPackage,
  PlacementCreativeExportPackage,
} from "@/lib/creative/export-packages";
import {
  buildChannelCreativeExportPackage,
  buildPlacementCreativeExportPackage,
} from "@/lib/creative/export-packages";
import type { PaidPlacementHandoff } from "@/lib/creative/paid-handoff";
import {
  buildGoogleChannelDraft,
  buildGooglePlacementDraft,
} from "@/lib/publish/drafts/google";
import {
  buildMetaChannelDraft,
  buildMetaPlacementDraft,
} from "@/lib/publish/drafts/meta";
import type { PublishChannel } from "@/lib/campaigns/workflow";
import type { Database } from "@/types/supabase";

type AdminSupabase = SupabaseClient<Database>;

export type PaidDraftChannel = "meta" | "google";

export type PaidPlacementDraft = {
  type: "paid_placement_draft";
  platform: PaidDraftChannel;
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  channel: PublishChannel;
  placementId: string;
  placementLabel: string;
  handoffName: string;
  naming: {
    recommendedFileStem: string;
    assetFileName: string | null;
    jsonFileName: string;
  };
  campaign: PlacementCreativeExportPackage["campaign"];
  readiness: {
    state: string;
    blocked: boolean;
    warnings: string[];
    summary: string;
  };
  handoff: PaidPlacementHandoff;
  internalIds: {
    campaignId: string;
    channel: PublishChannel;
    placementId: string;
    messageId: string | null;
    placementCopyId: string | null;
    creativeAssetId: string | null;
    derivativeAssetId: string | null;
  };
  mediaBuyerNotes: string[];
  tracking: PlacementCreativeExportPackage["tracking"];
  payload: Record<string, unknown>;
};

export type PaidChannelDraft = {
  type: "paid_channel_draft";
  platform: PaidDraftChannel;
  generatedAt: string;
  campaignId: string;
  campaignTitle: string;
  channel: PublishChannel;
  summary: {
    connectorLabel: string;
    placementCount: number;
    readyPlacements: number;
    warningPlacements: number;
    blockedPlacements: number;
  };
  campaign: ChannelCreativeExportPackage["campaign"];
  placements: PaidPlacementDraft[];
  tracking: ChannelCreativeExportPackage["tracking"];
  notes: string[];
};

export function isPaidDraftChannel(
  channel: PublishChannel,
): channel is PaidDraftChannel {
  return channel === "meta" || channel === "google";
}

export function buildPlacementPaidDraftFromPackage(
  pkg: PlacementCreativeExportPackage,
) {
  if (pkg.channel === "meta") return buildMetaPlacementDraft(pkg);
  if (pkg.channel === "google") return buildGooglePlacementDraft(pkg);
  throw new Error(`Paid draft not supported for channel ${pkg.channel}`);
}

export function buildChannelPaidDraftFromPackage(
  pkg: ChannelCreativeExportPackage,
) {
  if (!isPaidDraftChannel(pkg.channel)) {
    throw new Error(`Paid draft not supported for channel ${pkg.channel}`);
  }

  const placements = pkg.placements
    .filter((placement) => placement.paidHandoff.isPaidPlacement)
    .map((placement) => buildPlacementPaidDraftFromPackage(placement));

  if (!placements.length) {
    throw new Error(`No paid placements available for channel ${pkg.channel}`);
  }

  return pkg.channel === "meta"
    ? buildMetaChannelDraft(pkg, placements)
    : buildGoogleChannelDraft(pkg, placements);
}

export async function buildPlacementPaidDraft(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PaidDraftChannel;
  placementId: string;
}) {
  const pkg = await buildPlacementCreativeExportPackage({
    admin: args.admin,
    campaignId: args.campaignId,
    channel: args.channel,
    placementId: args.placementId as never,
  });
  return buildPlacementPaidDraftFromPackage(pkg);
}

export async function buildChannelPaidDraft(args: {
  admin: AdminSupabase;
  campaignId: string;
  channel: PaidDraftChannel;
}) {
  const pkg = await buildChannelCreativeExportPackage({
    admin: args.admin,
    campaignId: args.campaignId,
    channel: args.channel,
  });
  return buildChannelPaidDraftFromPackage(pkg);
}
