import type {
  BrandContext,
  ChannelType,
  ContentFormat,
  ContentGenerationInput,
  GeneratedMessage,
  ProviderGenerationMode,
  ProviderMetadata,
  ProviderName,
} from "@/lib/ai/schemas";
import type { CampaignMessageContent } from "@/lib/campaigns/workflow";
import { createMockAiProvider } from "@/lib/ai/providers/mock";
import { createOpenAiProvider } from "@/lib/ai/providers/openai";

export const AI_PROVIDER_NAMES = ["mock", "openai"] as const;

export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];
export type AiProviderStatus = "ready" | "fallback";

export type AiProviderInfo = {
  requestedProvider: AiProviderName;
  activeProvider: AiProviderName;
  status: AiProviderStatus;
  generationMode: ProviderGenerationMode;
  model: string | null;
  note: string | null;
  generatedAt: string;
  fallbackReason: string | null;
  requestId: string | null;
};

export type AiProviderGenerateContentInput = {
  input: ContentGenerationInput;
  brandContext: BrandContext;
  recommendedAngle: string;
  previousMessage?: CampaignMessageContent | null;
  previousRationale?: string | null;
  feedbackNote?: string | null;
  variantCount?: number;
};

export type AiProviderGenerateCampaignDraftInput = {
  items: AiProviderGenerateContentInput[];
};

export type AiProviderGenerateContentResult = {
  provider: AiProviderInfo;
  prompt: string;
  recommendedAngle: string | null;
  rationaleSummary: string | null;
  feedbackApplied: string | null;
  variants: GeneratedMessage[];
};

export type AiProviderGenerateCampaignDraftResult = {
  provider: AiProviderInfo;
  results: Array<{
    channel: ChannelType;
    format: ContentFormat;
    output: AiProviderGenerateContentResult;
  }>;
};

export type AiProvider = {
  name: AiProviderName;
  generateCampaignDraft(
    input: AiProviderGenerateCampaignDraftInput,
  ): Promise<AiProviderGenerateCampaignDraftResult>;
  generateContentVariants(
    input: AiProviderGenerateContentInput,
  ): Promise<AiProviderGenerateContentResult>;
  regenerateContentVariant(
    input: AiProviderGenerateContentInput,
  ): Promise<AiProviderGenerateContentResult>;
};

export function getRequestedAiProvider(): AiProviderName {
  return process.env.HANDI_AI_PROVIDER === "openai" ? "openai" : "mock";
}

export function toProviderMetadata(info: AiProviderInfo): ProviderMetadata {
  return {
    providerName: info.activeProvider as ProviderName,
    generationMode: info.generationMode,
    model: info.model,
    generatedAt: info.generatedAt,
    fallbackReason: info.fallbackReason,
    requestId: info.requestId,
    note: info.note,
  };
}

export function summarizeProviderStatus(info: AiProviderInfo): string | null {
  const parts = [
    info.generationMode,
    info.model ? `model=${info.model}` : null,
    info.note,
    info.fallbackReason,
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : null;
}

export function getAiProvider(): AiProvider {
  const requested = getRequestedAiProvider();
  if (requested === "openai") {
    return createOpenAiProvider({
      requestedProvider: requested,
      fallback: createMockAiProvider({
        requestedProvider: requested,
      }),
    });
  }

  return createMockAiProvider({
    requestedProvider: requested,
  });
}

export async function generateCampaignDraftWithProvider(
  input: AiProviderGenerateCampaignDraftInput,
): Promise<AiProviderGenerateCampaignDraftResult> {
  return getAiProvider().generateCampaignDraft(input);
}

export async function generateContentVariantsWithProvider(
  input: AiProviderGenerateContentInput,
): Promise<AiProviderGenerateContentResult> {
  return getAiProvider().generateContentVariants(input);
}

export async function regenerateContentVariantWithProvider(
  input: AiProviderGenerateContentInput,
): Promise<AiProviderGenerateContentResult> {
  return getAiProvider().regenerateContentVariant(input);
}
