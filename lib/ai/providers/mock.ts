import type {
  AiProvider,
  AiProviderGenerateCampaignDraftInput,
  AiProviderGenerateCampaignDraftResult,
  AiProviderGenerateContentInput,
  AiProviderGenerateContentResult,
  AiProviderInfo,
  AiProviderName,
} from "@/lib/ai/provider";
import type { GeneratedMessage } from "@/lib/ai/schemas";
import {
  buildChannelReason,
  buildFocusLine,
  buildGenerationPrompt,
  buildGuardrails,
  buildStructuredRationale,
  normalizeAppliedFeedback,
} from "@/lib/ai/providers/shared";

type CreateMockProviderParams = {
  requestedProvider: AiProviderName;
};

function buildProviderInfo(args: {
  requestedProvider: AiProviderName;
  fallbackReason?: string | null;
}): AiProviderInfo {
  const generatedAt = new Date().toISOString();
  const usingFallback = Boolean(args.fallbackReason);

  return {
    requestedProvider: args.requestedProvider,
    activeProvider: "mock",
    status: usingFallback ? "fallback" : "ready",
    generationMode: usingFallback ? "fallback" : "mock",
    model: null,
    note: usingFallback
      ? "Mock provider used after provider fallback."
      : "Using deterministic mock provider for internal review.",
    generatedAt,
    fallbackReason: args.fallbackReason || null,
    requestId: null,
  };
}

function buildVariantHeadline(args: {
  input: AiProviderGenerateContentInput["input"];
  recommendedAngle: string;
  previousHeadline?: string;
  feedbackNote?: string | null;
  variant: number;
}) {
  const angleLead = args.recommendedAngle.split(":")[0].trim();

  if (args.feedbackNote && args.variant === 1) {
    return `${angleLead} for ${args.input.serviceCategory}`;
  }
  if (args.variant === 2) {
    return `${args.input.offer} with Handi`;
  }
  if (args.previousHeadline) {
    return `${args.previousHeadline} - now clearer`;
  }
  return `${angleLead} with Handi`;
}

function buildVariantBody(args: {
  input: AiProviderGenerateContentInput["input"];
  recommendedAngle: string;
  previousBody?: string;
  feedbackNote?: string | null;
  variant: number;
}) {
  const previousPromise = args.previousBody
    ? `Keep the original promise around "${args.previousBody.replace(/\s+/g, " ").trim().slice(0, 120)}" but sharpen the next step.`
    : "";
  const feedbackLine = args.feedbackNote
    ? `Admin feedback to address: ${normalizeAppliedFeedback(args.feedbackNote)}.`
    : "";
  const structure =
    args.variant === 1
      ? "Lead with clarity first."
      : args.variant === 2
        ? "Lead with the offer and reassurance."
        : "Lead with the main objection and resolve it quickly.";

  return [
    buildFocusLine(args.input),
    args.input.offer,
    args.recommendedAngle,
    structure,
    previousPromise,
    feedbackLine,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildAudienceIntent(
  input: AiProviderGenerateContentInput["input"],
): string {
  if (input.audience === "client") {
    return "Reduce uncertainty and help the user feel safe taking the next step.";
  }
  if (input.audience === "professional") {
    return "Show that Handi brings more serious demand and a more credible path to action.";
  }
  return "Give the team a clearer operational reason to move forward.";
}

function buildVariants(
  input: AiProviderGenerateContentInput,
  prompt: string,
  provider: AiProviderInfo,
): GeneratedMessage[] {
  const count = Math.max(1, Math.min(3, input.variantCount || 3));
  const previousHeadline = input.previousMessage?.headline?.trim() || "";
  const previousBody = input.previousMessage?.body?.trim() || "";
  const feedbackApplied = normalizeAppliedFeedback(input.feedbackNote);
  const guardrailsApplied = buildGuardrails(input);

  return Array.from({ length: count }, (_, index) => {
    const variant = index + 1;
    const angle =
      variant === 1
        ? input.recommendedAngle
        : variant === 2
          ? `Offer-led version of ${input.recommendedAngle}`
          : `Objection-handling version of ${input.recommendedAngle}`;

    return {
      id: `${input.input.channel}-${variant}`,
      label: `Variant ${variant}`,
      channel: input.input.channel,
      format: input.input.format,
      angle: input.recommendedAngle,
      headline: buildVariantHeadline({
        input: input.input,
        recommendedAngle: input.recommendedAngle,
        previousHeadline,
        feedbackNote: input.feedbackNote,
        variant,
      }),
      body: buildVariantBody({
        input: input.input,
        recommendedAngle: input.recommendedAngle,
        previousBody,
        feedbackNote: input.feedbackNote,
        variant,
      }),
      cta: input.input.cta,
      rationale: buildStructuredRationale({
        angle,
        audienceIntent: buildAudienceIntent(input.input),
        whyChannel: buildChannelReason(input.input.channel),
        whyCta: `The CTA "${input.input.cta}" keeps the action specific and low friction.`,
        note: feedbackApplied
          ? `Applied admin feedback: ${feedbackApplied}`
          : input.previousMessage
            ? "Generated as a revision of the previous variant."
            : null,
        summary: feedbackApplied
          ? "Adjusted from explicit admin feedback while keeping the Handi brand cues intact."
          : "Variant keeps the Handi voice clear, calm, and action-oriented.",
      }),
      prompt,
      guardrailsApplied,
      providerMetadata: {
        providerName: provider.activeProvider,
        generationMode: provider.generationMode,
        model: provider.model,
        generatedAt: provider.generatedAt,
        fallbackReason: provider.fallbackReason,
        requestId: provider.requestId,
        note: provider.note,
      },
    } satisfies GeneratedMessage;
  });
}

async function generatePackage(args: {
  requestedProvider: AiProviderName;
  input: AiProviderGenerateContentInput;
  fallbackReason?: string | null;
}): Promise<AiProviderGenerateContentResult> {
  const prompt = buildGenerationPrompt(args.input);
  const provider = buildProviderInfo({
    requestedProvider: args.requestedProvider,
    fallbackReason: args.fallbackReason,
  });

  return {
    provider,
    prompt,
    recommendedAngle: args.input.recommendedAngle,
    rationaleSummary: args.input.feedbackNote
      ? `Updated the ${args.input.input.channel} proposal to address: ${normalizeAppliedFeedback(args.input.feedbackNote)}.`
      : `Built a ${args.input.input.channel} proposal that keeps the Handi voice clear, credible, and easy to act on.`,
    feedbackApplied: normalizeAppliedFeedback(args.input.feedbackNote),
    variants: buildVariants(args.input, prompt, provider),
  };
}

export function createMockAiProvider(
  params: CreateMockProviderParams,
): AiProvider {
  return {
    name: "mock",
    async generateCampaignDraft(
      input: AiProviderGenerateCampaignDraftInput,
    ): Promise<AiProviderGenerateCampaignDraftResult> {
      const results = await Promise.all(
        input.items.map(async (item) => ({
          channel: item.input.channel,
          format: item.input.format,
          output: await generatePackage({
            requestedProvider: params.requestedProvider,
            input: item,
          }),
        })),
      );

      return {
        provider:
          results[0]?.output.provider ||
          buildProviderInfo({
            requestedProvider: params.requestedProvider,
          }),
        results,
      };
    },
    async generateContentVariants(
      input: AiProviderGenerateContentInput,
    ): Promise<AiProviderGenerateContentResult> {
      return generatePackage({
        requestedProvider: params.requestedProvider,
        input,
      });
    },
    async regenerateContentVariant(
      input: AiProviderGenerateContentInput,
    ): Promise<AiProviderGenerateContentResult> {
      return generatePackage({
        requestedProvider: params.requestedProvider,
        input,
      });
    },
  };
}
