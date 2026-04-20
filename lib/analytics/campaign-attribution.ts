import type {
  CampaignGoal,
  ProviderGenerationMode,
  ProviderName,
} from "@/lib/ai/schemas";
import type { TrackingContract } from "@/lib/analytics/schemas";
import { buildTrackingContract } from "@/lib/analytics/tracking-contracts";
import type { PublishChannel } from "@/lib/campaigns/workflow";

export function buildCampaignAttributionMapping(args: {
  campaignId: string;
  campaignTitle: string;
  goal: CampaignGoal;
  channel: PublishChannel;
  placementId?: string | null;
  messageId?: string | null;
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
  return buildTrackingContract(args);
}
