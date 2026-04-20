import type { PublishConnectorDefinition } from "@/lib/publish/types";

export const whatsappPublishConnector: PublishConnectorDefinition = {
  channel: "whatsapp",
  label: "WhatsApp",
  supportedModes: ["draft", "export"],
  defaultMode: "draft",
  capability: "draft",
  description:
    "Prepares approved WhatsApp copy for controlled manual delivery. Live delivery stays disabled in this phase.",
  async execute(input) {
    const payload = {
      campaignId: input.campaign.id,
      channel: "whatsapp",
      mode: input.mode,
      targetPhone: input.targeting.targetPhone,
      message: {
        headline: input.message?.content.headline || input.campaign.title,
        body: input.message?.content.body || input.campaign.rationale_summary,
        cta: input.message?.content.cta || input.campaign.cta,
      },
    };

    if (input.mode === "live") {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "whatsapp",
        providerResponseSummary:
          "WhatsApp live publishing is disabled in phase 7.",
        payload,
        externalReferenceId: null,
        errorMessage:
          "WhatsApp live publishing remains disabled. Use draft/export mode for this phase.",
      };
    }

    return {
      publishStatus: "published",
      publishMode: input.mode,
      providerName: "whatsapp",
      providerResponseSummary:
        input.mode === "export"
          ? "WhatsApp payload exported for manual delivery."
          : "WhatsApp draft prepared for controlled handoff.",
      payload,
      externalReferenceId: null,
      errorMessage: null,
    };
  },
};
