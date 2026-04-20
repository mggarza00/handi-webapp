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
