import type { ChannelType, ContentGenerationInput } from "@/lib/ai/schemas";
import type { AiProviderGenerateContentInput } from "@/lib/ai/provider";
import { buildEmailPrompt } from "@/lib/ai/prompts/content-email";
import { buildLandingPrompt } from "@/lib/ai/prompts/content-landing";
import { buildMetaAdPrompt } from "@/lib/ai/prompts/content-meta";
import { buildPushPrompt } from "@/lib/ai/prompts/content-push";
import { buildWhatsAppPrompt } from "@/lib/ai/prompts/content-whatsapp";
import { serializeMessageRationale } from "@/lib/campaigns/workflow";

function normalizeFeedback(value: string | null | undefined): string {
  return (value || "").trim();
}

export function shortFeedback(value: string) {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

export function selectPromptBuilder(channel: ChannelType) {
  if (channel === "meta") return buildMetaAdPrompt;
  if (channel === "email") return buildEmailPrompt;
  if (channel === "whatsapp") return buildWhatsAppPrompt;
  if (channel === "push") return buildPushPrompt;
  return buildLandingPrompt;
}

export function buildGenerationPrompt(
  input: AiProviderGenerateContentInput,
): string {
  const prompt = selectPromptBuilder(input.input.channel)({
    input: {
      ...input.input,
      notes: [input.input.notes, input.feedbackNote].filter(Boolean).join("\n"),
    },
    brandContext: input.brandContext,
    recommendedAngle: input.recommendedAngle,
  });

  const previousSections = [
    input.previousMessage
      ? `Previous headline:\n${input.previousMessage.headline}`
      : "",
    input.previousMessage
      ? `Previous body:\n${input.previousMessage.body}`
      : "",
    input.previousRationale
      ? `Previous rationale:\n${input.previousRationale}`
      : "",
    input.feedbackNote
      ? `Admin feedback to apply:\n${shortFeedback(input.feedbackNote)}`
      : "",
  ].filter(Boolean);

  if (!previousSections.length) return prompt;

  return [prompt, "", "Revision context:", ...previousSections].join("\n");
}

export function buildGuardrails(input: AiProviderGenerateContentInput) {
  return [
    ...input.brandContext.languageRules,
    ...input.brandContext.channelRules.doList,
    ...input.brandContext.channelRules.dontList,
    ...input.brandContext.channelRules.ctaRules,
  ];
}

export function buildFocusLine(input: ContentGenerationInput): string {
  if (input.audience === "client") {
    return `Use Handi to make ${input.serviceCategory} feel safer, simpler, and easier to act on.`;
  }
  if (input.audience === "professional") {
    return `Show that Handi turns ${input.serviceCategory} into more serious and credible opportunities.`;
  }
  return `Position Handi as a reliable operating layer for ${input.serviceCategory}.`;
}

export function buildChannelReason(channel: ChannelType): string {
  if (channel === "meta") {
    return "It earns attention fast and lets Handi lead with confidence before asking for the click.";
  }
  if (channel === "email") {
    return "It gives enough room to explain the value clearly and reduce uncertainty.";
  }
  if (channel === "whatsapp") {
    return "It keeps the follow-up personal, direct, and useful without sounding pushy.";
  }
  if (channel === "push") {
    return "It works for short reminders where the message must stay timely and low friction.";
  }
  return "It gives the audience one place to understand trust, value, and the next step.";
}

export function buildStructuredRationale(args: {
  angle: string;
  audienceIntent: string;
  whyChannel: string;
  whyCta: string;
  summary: string;
  note?: string | null;
}) {
  return serializeMessageRationale({
    angle: args.angle,
    audienceIntent: args.audienceIntent,
    whyChannel: args.whyChannel,
    whyCta: args.whyCta,
    note: args.note || null,
    summary: args.summary,
  });
}

export function normalizeAppliedFeedback(value: string | null | undefined) {
  const feedback = normalizeFeedback(value);
  return feedback ? shortFeedback(feedback) : null;
}
