import type { PublishConnectorDefinition } from "@/lib/publish/types";

export const googlePublishConnector: PublishConnectorDefinition = {
  channel: "google",
  label: "Google ads",
  supportedModes: ["export"],
  defaultMode: "export",
  capability: "export",
  description:
    "Builds a structured Google export payload from approved campaign copy without sending it live.",
  async execute(input) {
    const payload = {
      platform: "google",
      campaignId: input.campaign.id,
      campaignTitle: input.campaign.title,
      audience: input.campaign.audience,
      goal: input.campaign.goal,
      serviceCategory: input.campaign.service_category,
      offer: input.campaign.offer,
      cta: input.message?.content.cta || input.campaign.cta,
      recommendedAngle: input.campaign.recommended_angle,
      adCopy: {
        headlines: [
          input.message?.content.headline || input.campaign.title,
          input.campaign.offer,
        ].filter(Boolean),
        descriptions: [
          input.message?.content.body || input.campaign.rationale_summary,
        ],
      },
      rationale: input.message?.rationale_parts?.summary || null,
      qa: input.message?.qa_report || input.campaign.qa_report,
      provider:
        input.message?.provider_metadata || input.campaign.provider_metadata,
    };

    return {
      publishStatus: "published",
      publishMode: "export",
      providerName: "google",
      providerResponseSummary: "Google export payload generated.",
      payload,
      externalReferenceId: null,
      errorMessage: null,
    };
  },
};
