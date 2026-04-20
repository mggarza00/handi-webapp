import { sendEmail } from "@/lib/email";
import { buildCreativeBundlePayload } from "@/lib/creative/bundles";
import type { PublishConnectorDefinition } from "@/lib/publish/types";

function buildEmailHtml(args: {
  headline: string;
  body: string;
  cta: string;
  offer: string;
  serviceCategory: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; background: #f6f2ea; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #d9d5cd;">
        <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8; font-weight: 700;">
          Handi campaign
        </div>
        <h1 style="font-size: 28px; line-height: 1.2; color: #0f172a; margin: 16px 0 12px;">
          ${args.headline}
        </h1>
        <p style="font-size: 16px; line-height: 1.7; color: #334155; margin: 0 0 20px;">
          ${args.body}
        </p>
        <div style="font-size: 14px; color: #475569; margin-bottom: 20px;">
          Offer: ${args.offer}<br />
          Service: ${args.serviceCategory}
        </div>
        <div style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 12px 18px; border-radius: 999px; font-weight: 700;">
          ${args.cta}
        </div>
      </div>
    </div>
  `.trim();
}

export const emailPublishConnector: PublishConnectorDefinition = {
  channel: "email",
  label: "Email",
  supportedModes: ["live", "draft", "export"],
  defaultMode: "live",
  capability: "live",
  description:
    "Sends approved campaign email copy through Resend when recipients are provided.",
  async execute(input) {
    const recipients = input.targeting.targetEmails;
    const message = input.message;
    const tags = [
      { name: "campaign_id", value: input.campaign.id },
      { name: "publish_job_id", value: input.publishJobId },
      ...(message?.id ? [{ name: "message_id", value: message.id }] : []),
    ];
    const payload = {
      campaignId: input.campaign.id,
      publishJobId: input.publishJobId,
      messageId: message?.id || null,
      channel: "email",
      mode: input.mode,
      recipients,
      tags,
      subject: message?.content.headline || input.campaign.title,
      html: buildEmailHtml({
        headline: message?.content.headline || input.campaign.title,
        body: message?.content.body || input.campaign.rationale_summary,
        cta: message?.content.cta || input.campaign.cta,
        offer: input.campaign.offer,
        serviceCategory: input.campaign.service_category,
      }),
      text: [
        message?.content.headline,
        message?.content.body,
        message?.content.cta,
      ]
        .filter(Boolean)
        .join("\n\n"),
      creative: buildCreativeBundlePayload(input.creativeBundle),
    };

    if (input.mode !== "live") {
      return {
        publishStatus: "published",
        publishMode: input.mode,
        providerName: "resend",
        providerResponseSummary:
          input.mode === "export"
            ? "Email payload exported for manual use."
            : "Email draft prepared without sending.",
        payload,
        externalReferenceId: null,
        errorMessage: null,
        analyticsSnapshot: null,
      };
    }

    if (!recipients.length) {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "resend",
        providerResponseSummary: "Email publish failed before send.",
        payload,
        externalReferenceId: null,
        errorMessage: "Live email publishing requires at least one recipient.",
        analyticsSnapshot: {
          events: [
            {
              campaignDraftId: input.campaign.id,
              campaignMessageId: message?.id || undefined,
              publishJobId: input.publishJobId,
              channel: "email",
              eventType: "failed",
              count: recipients.length || 1,
              source: "email_dispatch_snapshot",
              metadata: {
                failureReason: "missing_recipients",
              },
            },
          ],
        },
      };
    }

    const result = await sendEmail({
      to: recipients,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      tags,
    });

    if (!result.ok) {
      return {
        publishStatus: "publish_failed",
        publishMode: input.mode,
        providerName: "resend",
        providerResponseSummary:
          result.hint || result.error || "Email send failed.",
        payload,
        externalReferenceId: result.id || null,
        errorMessage: result.error || "Failed to send email via Resend.",
        analyticsSnapshot: {
          events: [
            {
              campaignDraftId: input.campaign.id,
              campaignMessageId: message?.id || undefined,
              publishJobId: input.publishJobId,
              channel: "email",
              eventType: "failed",
              count: recipients.length || 1,
              source: "email_dispatch_snapshot",
              metadata: {
                failureReason: result.error || "send_failed",
                hint: result.hint || null,
              },
            },
          ],
        },
      };
    }

    return {
      publishStatus: "published",
      publishMode: input.mode,
      providerName: "resend",
      providerResponseSummary: `Email sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`,
      payload,
      externalReferenceId: result.id || null,
      errorMessage: null,
      analyticsSnapshot: null,
    };
  },
};
