import type {
  CampaignGoal,
  ProviderGenerationMode,
  ProviderName,
} from "@/lib/ai/schemas";
import type {
  SuggestedTrackingEvent,
  TrackingContract,
  TrackingIdentifiers,
  UtmMapping,
} from "@/lib/analytics/schemas";
import type { PublishChannel } from "@/lib/campaigns/workflow";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function channelToUtmMedium(channel: PublishChannel) {
  if (channel === "meta") return "paid_social";
  if (channel === "google") return "paid_display";
  if (channel === "email") return "email";
  if (channel === "push") return "push";
  if (channel === "whatsapp") return "messaging";
  return "owned_landing";
}

function channelToUtmSource(channel: PublishChannel) {
  if (channel === "meta") return "meta";
  if (channel === "google") return "google";
  if (channel === "email") return "handi-email";
  if (channel === "push") return "handi-push";
  if (channel === "whatsapp") return "handi-whatsapp";
  return "handi-site";
}

export function buildBaseUtmMapping(args: {
  campaignId: string;
  campaignTitle: string;
  goal: CampaignGoal;
  channel: PublishChannel;
  placementId?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  serviceCategory?: string | null;
  creativeAssetId?: string | null;
}): UtmMapping {
  return {
    utm_source: channelToUtmSource(args.channel),
    utm_medium: channelToUtmMedium(args.channel),
    utm_campaign: slugify(
      `${args.goal}-${args.campaignId.slice(0, 8)}-${args.campaignTitle}`,
    ),
    utm_content: slugify(
      [
        args.channel,
        args.placementId || "channel",
        args.variantId || args.variantName || "default-variant",
        args.variantName || "default-copy",
        args.creativeAssetId ? args.creativeAssetId.slice(0, 8) : "no-asset",
      ].join("-"),
    ),
    utm_term: args.serviceCategory ? slugify(args.serviceCategory) : null,
  };
}

export function buildSuggestedTrackingEvents(args: {
  channel: PublishChannel;
  placementId?: string | null;
}): SuggestedTrackingEvent[] {
  return [
    {
      name: "landing_viewed",
      channel: args.channel,
      placementId: args.placementId || null,
      ga4Recommended: true,
      description:
        "Trigger when the owned landing or tracked campaign surface is rendered.",
    },
    {
      name: "primary_cta_clicked",
      channel: args.channel,
      placementId: args.placementId || null,
      ga4Recommended: true,
      description:
        "Trigger when the user clicks the primary CTA tied to the campaign journey.",
    },
    {
      name: "request_created",
      channel: args.channel,
      placementId: args.placementId || null,
      ga4Recommended: true,
      description:
        "Use for customer-side conversion when the request funnel completes.",
    },
    {
      name: "pro_apply_completed",
      channel: args.channel,
      placementId: args.placementId || null,
      ga4Recommended: true,
      description:
        "Use for professional acquisition flows when the application is submitted.",
    },
    {
      name: "fee_paid",
      channel: args.channel,
      placementId: args.placementId || null,
      ga4Recommended: true,
      description:
        "Use for monetization-related conversions when the fee payment is confirmed.",
    },
  ];
}

export function buildTrackingContract(args: {
  campaignId: string;
  campaignTitle: string;
  goal: CampaignGoal;
  channel: PublishChannel;
  placementId?: string | null;
  messageId?: string | null;
  placementMessageId?: string | null;
  placementCopySource?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  creativeAssetId?: string | null;
  derivativeAssetId?: string | null;
  bundleStatus?: string | null;
  readinessStatus?: string | null;
  providerName?: ProviderName | null;
  providerMode?: ProviderGenerationMode | null;
  serviceCategory?: string | null;
}): TrackingContract {
  const identifiers: TrackingIdentifiers = {
    campaignId: args.campaignId,
    campaignTitle: args.campaignTitle,
    goal: args.goal,
    channel: args.channel,
    placementId: args.placementId || null,
    messageId: args.messageId || null,
    placementMessageId: args.placementMessageId || null,
    placementCopySource: args.placementCopySource || null,
    variantId: args.variantId || null,
    variantName: args.variantName || null,
    creativeAssetId: args.creativeAssetId || null,
    derivativeAssetId: args.derivativeAssetId || null,
    bundleStatus: args.bundleStatus || null,
    readinessStatus: args.readinessStatus || null,
    providerName: args.providerName || null,
    providerMode: args.providerMode || null,
  };

  return {
    identifiers,
    utm: buildBaseUtmMapping({
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      goal: args.goal,
      channel: args.channel,
      placementId: args.placementId,
      variantId: args.variantId,
      variantName: args.variantName,
      serviceCategory: args.serviceCategory,
      creativeAssetId: args.creativeAssetId,
    }),
    ga4: {
      eventNamespace: "handi_campaign",
      suggestedEvents: buildSuggestedTrackingEvents({
        channel: args.channel,
        placementId: args.placementId,
      }),
      customParams: {
        campaign_id: args.campaignId,
        channel: args.channel,
        placement_id: args.placementId || null,
        message_id: args.messageId || null,
        placement_copy_id: args.placementMessageId || null,
        placement_copy_source: args.placementCopySource || null,
        variant_id: args.variantId || args.variantName || null,
        variant_name: args.variantName || null,
        creative_asset_id: args.creativeAssetId || null,
        derivative_asset_id: args.derivativeAssetId || null,
        readiness_status: args.readinessStatus || null,
        bundle_status: args.bundleStatus || null,
        utm_source: channelToUtmSource(args.channel),
        utm_medium: channelToUtmMedium(args.channel),
      },
    },
    clarity: {
      tags: {
        handi_campaign_id: args.campaignId,
        handi_channel: args.channel,
        handi_placement_id: args.placementId || "channel",
        handi_message_id: args.messageId || "none",
        handi_placement_copy_id: args.placementMessageId || "none",
        handi_placement_copy_source: args.placementCopySource || "inherited",
        handi_creative_asset_id: args.creativeAssetId || "none",
      },
      notes: [
        "Use Clarity custom tags to correlate sessions with Campaign OS identifiers.",
        "GA4 should receive the same campaign/channel/placement identifiers to keep attribution legible.",
      ],
    },
  };
}
