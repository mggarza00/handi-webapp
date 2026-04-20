import { buildCampaignAttributionMapping } from "@/lib/analytics/campaign-attribution";
import {
  type ProviderGenerationMode,
  type ProviderName,
} from "@/lib/ai/schemas";
import { buildCreativeBundlePayload } from "@/lib/creative/bundles";
import { buildChannelPlacementCoverage } from "@/lib/creative/placements";
import type { PublishConnectorDefinition } from "@/lib/publish/types";

export const landingPublishConnector: PublishConnectorDefinition = {
  channel: "landing",
  label: "Landing",
  supportedModes: ["draft", "export"],
  defaultMode: "draft",
  capability: "draft",
  description:
    "Builds approved landing copy payloads for manual placement. No CMS publishing is active in this phase.",
  async execute(input) {
    const placementCoverage = await buildChannelPlacementCoverage({
      admin: input.admin,
      campaignId: input.campaign.id,
      channel: "landing",
      bundle: input.creativeBundle,
    });
    const tracking = buildCampaignAttributionMapping({
      campaignId: input.campaign.id,
      campaignTitle: input.campaign.title,
      goal: input.campaign.goal,
      channel: "landing",
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
      platform: "landing",
      campaignId: input.campaign.id,
      campaignTitle: input.campaign.title,
      serviceCategory: input.campaign.service_category,
      offer: input.campaign.offer,
      recommendedAngle: input.campaign.recommended_angle,
      sections: {
        heroTitle: input.message?.content.headline || input.campaign.title,
        heroBody:
          input.message?.content.body || input.campaign.rationale_summary,
        primaryCta: input.message?.content.cta || input.campaign.cta,
      },
      qa: input.message?.qa_report || input.campaign.qa_report,
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
          channel: "landing",
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
      publishMode: input.mode,
      providerName: "landing",
      providerResponseSummary:
        input.mode === "export"
          ? "Landing payload exported for manual implementation."
          : "Landing draft payload prepared for editorial handoff.",
      payload,
      externalReferenceId: null,
      errorMessage: null,
    };
  },
};
