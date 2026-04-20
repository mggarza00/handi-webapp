import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import type {
  AiProvider,
  AiProviderGenerateCampaignDraftInput,
  AiProviderGenerateCampaignDraftResult,
  AiProviderGenerateContentInput,
  AiProviderGenerateContentResult,
  AiProviderInfo,
  AiProviderName,
} from "@/lib/ai/provider";
import {
  generatedMessageSchema,
  llmContentPackageSchema,
  type GeneratedMessage,
} from "@/lib/ai/schemas";
import {
  buildGenerationPrompt,
  buildGuardrails,
  buildStructuredRationale,
  normalizeAppliedFeedback,
} from "@/lib/ai/providers/shared";

type CreateOpenAiProviderParams = {
  requestedProvider: AiProviderName;
  fallback: AiProvider;
};

function getOpenAiModel(isRegeneration: boolean) {
  if (isRegeneration) {
    return (
      process.env.OPENAI_REASONING_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      process.env.HANDI_OPENAI_MODEL?.trim() ||
      "gpt-4o-mini"
    );
  }

  return (
    process.env.OPENAI_MODEL?.trim() ||
    process.env.HANDI_OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function createClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

function buildProviderInfo(args: {
  requestedProvider: AiProviderName;
  model: string | null;
  requestId: string | null;
}): AiProviderInfo {
  return {
    requestedProvider: args.requestedProvider,
    activeProvider: "openai",
    status: "ready",
    generationMode: "live",
    model: args.model,
    note: "OpenAI live generation completed.",
    generatedAt: new Date().toISOString(),
    fallbackReason: null,
    requestId: args.requestId,
  };
}

function toFallbackProviderResult(args: {
  result: AiProviderGenerateContentResult;
  requestedProvider: AiProviderName;
  model: string | null;
  reason: string;
}): AiProviderGenerateContentResult {
  const generatedAt = new Date().toISOString();
  const provider: AiProviderInfo = {
    requestedProvider: args.requestedProvider,
    activeProvider: "mock",
    status: "fallback",
    generationMode: "fallback",
    model: args.model,
    note: "Mock provider used after OpenAI fallback.",
    generatedAt,
    fallbackReason: args.reason,
    requestId: null,
  };

  const variants = args.result.variants.map((variant) => ({
    ...variant,
    providerMetadata: {
      providerName: "mock" as const,
      generationMode: "fallback" as const,
      model: args.model,
      generatedAt,
      fallbackReason: args.reason,
      requestId: null,
      note: "Mock provider used after OpenAI fallback.",
    },
  }));

  return {
    ...args.result,
    provider,
    variants,
  };
}

function mapParsedPackageToVariants(args: {
  input: AiProviderGenerateContentInput;
  prompt: string;
  provider: AiProviderInfo;
  parsed: ReturnType<typeof llmContentPackageSchema.parse>;
}): GeneratedMessage[] {
  const guardrailsApplied = buildGuardrails(args.input);

  return args.parsed.variants.map((variant, index) => ({
    id: `${args.input.input.channel}-${index + 1}`,
    label: variant.label.trim(),
    channel: args.input.input.channel,
    format: args.input.input.format,
    angle: args.parsed.recommendedAngle,
    headline: variant.headline.trim(),
    body: variant.body.trim(),
    cta: variant.cta.trim() || args.input.input.cta,
    rationale: buildStructuredRationale({
      angle: variant.rationale.angle,
      audienceIntent: variant.rationale.audienceIntent,
      whyChannel: variant.rationale.whyChannel,
      whyCta: variant.rationale.whyCta,
      note:
        variant.rationale.note ||
        (args.parsed.feedbackApplied
          ? `Applied feedback: ${args.parsed.feedbackApplied}`
          : null),
      summary: variant.rationale.summary,
    }),
    prompt: args.prompt,
    guardrailsApplied,
    providerMetadata: {
      providerName: "openai",
      generationMode: "live",
      model: args.provider.model,
      generatedAt: args.provider.generatedAt,
      fallbackReason: null,
      requestId: args.provider.requestId,
      note: args.provider.note,
    },
  }));
}

async function callOpenAi(args: {
  client: OpenAI;
  requestedProvider: AiProviderName;
  input: AiProviderGenerateContentInput;
}): Promise<AiProviderGenerateContentResult> {
  const prompt = buildGenerationPrompt(args.input);
  const model = getOpenAiModel(
    Boolean(args.input.previousMessage || args.input.feedbackNote),
  );
  const variantCount = Math.max(1, Math.min(3, args.input.variantCount || 3));
  const completion = await args.client.chat.completions.parse({
    model,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content: [
          "You generate campaign copy for Handi's internal editorial workflow.",
          "Follow the provided brand and channel brief exactly.",
          "Return concise, useful rationale for internal reviewers.",
          "Do not mention policies, schemas, or that you are an AI.",
          "Do not use gimmicky urgency or risky claims.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          prompt,
          "",
          "Return structured output for this request:",
          `- Variants needed: ${variantCount}`,
          `- Keep the CTA aligned to: ${args.input.input.cta}`,
          `- Keep the core offer aligned to: ${args.input.input.offer}`,
          args.input.feedbackNote
            ? `- Explicit feedback to address: ${normalizeAppliedFeedback(args.input.feedbackNote)}`
            : "- No explicit admin feedback to apply.",
          args.input.previousMessage
            ? "- This is a revision request, so improve on the previous copy instead of starting from zero."
            : "- This is a fresh generation request.",
          "Rationale must stay short, operational, and easy to review in admin.",
        ].join("\n"),
      },
    ],
    response_format: zodResponseFormat(
      llmContentPackageSchema,
      "handi_campaign_content_package",
    ),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  const validated = llmContentPackageSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("OpenAI returned invalid structured content.");
  }

  const provider = buildProviderInfo({
    requestedProvider: args.requestedProvider,
    model,
    requestId: completion.id || null,
  });
  const variants = mapParsedPackageToVariants({
    input: args.input,
    prompt,
    provider,
    parsed: validated.data,
  });
  const finalVariants = generatedMessageSchema.array().safeParse(variants);
  if (!finalVariants.success) {
    throw new Error("OpenAI mapped output failed local validation.");
  }

  return {
    provider,
    prompt,
    recommendedAngle: validated.data.recommendedAngle,
    rationaleSummary: validated.data.rationaleSummary,
    feedbackApplied: validated.data.feedbackApplied || null,
    variants: finalVariants.data,
  };
}

async function withFallback(
  params: CreateOpenAiProviderParams,
  input: AiProviderGenerateContentInput,
  reason: string,
  isRegeneration: boolean,
): Promise<AiProviderGenerateContentResult> {
  const fallbackResult = isRegeneration
    ? await params.fallback.regenerateContentVariant(input)
    : await params.fallback.generateContentVariants(input);

  return toFallbackProviderResult({
    result: fallbackResult,
    requestedProvider: params.requestedProvider,
    model: getOpenAiModel(Boolean(input.previousMessage || input.feedbackNote)),
    reason,
  });
}

export function createOpenAiProvider(
  params: CreateOpenAiProviderParams,
): AiProvider {
  const generateContentVariants = async (
    input: AiProviderGenerateContentInput,
  ): Promise<AiProviderGenerateContentResult> => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return withFallback(
        params,
        input,
        "OPENAI_API_KEY is missing, so the workflow used the mock provider.",
        false,
      );
    }

    try {
      return await callOpenAi({
        client: createClient(apiKey),
        requestedProvider: params.requestedProvider,
        input,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown OpenAI error";
      console.error("[campaigns][openai] generateContentVariants", message);
      return withFallback(
        params,
        input,
        `OpenAI generation failed: ${message}`,
        false,
      );
    }
  };

  const regenerateContentVariant = async (
    input: AiProviderGenerateContentInput,
  ): Promise<AiProviderGenerateContentResult> => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return withFallback(
        params,
        input,
        "OPENAI_API_KEY is missing, so regeneration used the mock provider.",
        true,
      );
    }

    try {
      return await callOpenAi({
        client: createClient(apiKey),
        requestedProvider: params.requestedProvider,
        input,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown OpenAI error";
      console.error("[campaigns][openai] regenerateContentVariant", message);
      return withFallback(
        params,
        input,
        `OpenAI regeneration failed: ${message}`,
        true,
      );
    }
  };

  const generateCampaignDraft = async (
    input: AiProviderGenerateCampaignDraftInput,
  ): Promise<AiProviderGenerateCampaignDraftResult> => {
    const results = await Promise.all(
      input.items.map(async (item) => ({
        channel: item.input.channel,
        format: item.input.format,
        output: await generateContentVariants(item),
      })),
    );

    return {
      provider: results[0]?.output.provider || {
        requestedProvider: params.requestedProvider,
        activeProvider: "mock",
        status: "fallback",
        generationMode: "fallback",
        model: getOpenAiModel(false),
        note: "No content items were generated.",
        generatedAt: new Date().toISOString(),
        fallbackReason: "No content items were provided.",
        requestId: null,
      },
      results,
    };
  };

  return {
    name: "openai",
    generateCampaignDraft,
    generateContentVariants,
    regenerateContentVariant,
  };
}
