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
