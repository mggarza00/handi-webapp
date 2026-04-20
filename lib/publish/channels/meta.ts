import { buildCampaignAttributionMapping } from "@/lib/analytics/campaign-attribution";
import {
  type ProviderGenerationMode,
  type ProviderName,
} from "@/lib/ai/schemas";
import { buildCreativeBundlePayload } from "@/lib/creative/bundles";
import { buildChannelPlacementCoverage } from "@/lib/creative/placements";
import type { PublishConnectorDefinition } from "@/lib/publish/types";

export const metaPublishConnector: PublishConnectorDefinition = {
  channel: "meta",
  label: "Meta ads",
  supportedModes: ["export"],
  defaultMode: "export",
  capability: "export",
  description:
    "Builds a structured Meta export payload from approved campaign copy without sending it live.",
  async execute(input) {
    const placementCoverage = await buildChannelPlacementCoverage({
      admin: input.admin,
      campaignId: input.campaign.id,
      channel: "meta",
      bundle: input.creativeBundle,
    });
    const tracking = buildCampaignAttributionMapping({
      campaignId: input.campaign.id,
      campaignTitle: input.campaign.title,
      goal: input.campaign.goal,
      channel: "meta",
      messageId: input.message?.id || null,
      variantName: input.message?.variant_name || null,
      creativeAssetId: input.creativeBundle?.selected_asset?.id || null,
      derivativeAssetId:
        input.creativeBundle?.selected_asset?.asset_role === "derivative"
          ? input.creativeBundle.selected_asset.id
          : null,
      bundleStatus: input.creativeBundle?.suitability_status || null,
      readinessStatus: placementCoverage.overallState,
      providerName:
        (input.creativeBundle?.selected_asset?.provider_metadata
          ?.providerName as ProviderName | null) ||
        (input.message?.provider_metadata
          .providerName as ProviderName | null) ||
        null,
      providerMode:
        (input.creativeBundle?.selected_asset?.provider_metadata
          ?.generationMode as ProviderGenerationMode | null) ||
        (input.message?.provider_metadata
          .generationMode as ProviderGenerationMode | null) ||
        null,
      serviceCategory: input.campaign.service_category,
    });
    const payload = {
      platform: "meta",
      campaignId: input.campaign.id,
      campaignTitle: input.campaign.title,
      audience: input.campaign.audience,
      goal: input.campaign.goal,
      serviceCategory: input.campaign.service_category,
      offer: input.campaign.offer,
      cta: input.message?.content.cta || input.campaign.cta,
      recommendedAngle: input.campaign.recommended_angle,
      copy: {
        headline: input.message?.content.headline || input.campaign.title,
        primaryText:
          input.message?.content.body || input.campaign.rationale_summary,
      },
      rationale: input.message?.rationale_parts?.summary || null,
      qa: input.message?.qa_report || input.campaign.qa_report,
      provider:
        input.message?.provider_metadata || input.campaign.provider_metadata,
      creative: buildCreativeBundlePayload(input.creativeBundle),
      placements: placementCoverage.placements.map((placement) => ({
        placementId: placement.placementId,
        label: placement.placementLabel,
        readiness: placement.state,
        warnings: placement.warnings,
        selectedAsset: placement.selectedAsset
          ? {
              id: placement.selectedAsset.id,
              variantLabel: placement.selectedAsset.variantLabel,
              format: placement.selectedAsset.format,
              width: placement.selectedAsset.width,
              height: placement.selectedAsset.height,
              storagePath: placement.selectedAsset.storagePath,
            }
          : null,
        tracking: buildCampaignAttributionMapping({
          campaignId: input.campaign.id,
          campaignTitle: input.campaign.title,
          goal: input.campaign.goal,
          channel: "meta",
          placementId: placement.placementId,
          messageId: input.message?.id || null,
          variantName: input.message?.variant_name || null,
          creativeAssetId: placement.selectedAsset?.id || null,
          derivativeAssetId:
            placement.selectedAsset?.role === "derivative"
              ? placement.selectedAsset.id
              : null,
          bundleStatus: input.creativeBundle?.suitability_status || null,
          readinessStatus: placement.state,
          providerName:
            (placement.selectedAsset?.providerMetadata
              ?.providerName as ProviderName | null) ||
            (input.message?.provider_metadata
              .providerName as ProviderName | null) ||
            null,
          providerMode:
            (placement.selectedAsset?.providerMetadata
              ?.generationMode as ProviderGenerationMode | null) ||
            (input.message?.provider_metadata
              .generationMode as ProviderGenerationMode | null) ||
            null,
          serviceCategory: input.campaign.service_category,
        }),
      })),
      tracking,
    };

    return {
      publishStatus: "published",
      publishMode: "export",
      providerName: "meta",
      providerResponseSummary: "Meta export payload generated.",
      payload,
      externalReferenceId: null,
      errorMessage: null,
    };
  },
};
