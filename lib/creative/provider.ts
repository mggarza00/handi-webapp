import type {
  ProviderErrorType,
  ProviderGenerationMode,
  ProviderMetadata,
  ProviderName,
} from "@/lib/ai/schemas";
import { createImageCreativeProvider } from "@/lib/creative/providers/image-provider";
import { createMockCreativeProvider } from "@/lib/creative/providers/mock";
import type {
  CreativeBriefPayload,
  CreativeAssetFormat,
} from "@/lib/creative/workflow";

export const CREATIVE_PROVIDER_NAMES = ["mock", "image-provider"] as const;

export type CreativeProviderName = (typeof CREATIVE_PROVIDER_NAMES)[number];

export type CreativeProviderInfo = {
  requestedProvider: CreativeProviderName;
  activeProvider: ProviderName;
  generationMode: ProviderGenerationMode;
  status: "ready" | "fallback";
  model: string | null;
  note: string | null;
  generatedAt: string;
  fallbackReason: string | null;
  requestId: string | null;
  errorType?: ProviderErrorType | null;
  promptSummary?: string | null;
  providerReferenceId?: string | null;
  assetWidth?: number | null;
  assetHeight?: number | null;
  outputFormat?: string | null;
  quality?: string | null;
  seed?: string | null;
  responseSummary?: string | null;
};

export type CreativeGeneratedAsset = {
  label: string;
  format: CreativeAssetFormat;
  promptText: string;
  rationale: string;
  mimeType: string;
  buffer: Buffer;
  providerMetadata?: Partial<ProviderMetadata> | null;
};

export type CreativeGenerateImageInput = {
  brief: CreativeBriefPayload;
  variantCount?: number;
};

export type CreativeRegenerateImageInput = {
  brief: CreativeBriefPayload;
  previousPrompt: string;
  previousRationale: string;
  feedbackNote?: string | null;
};

export type CreativeGenerateImageResult = {
  provider: CreativeProviderInfo;
  briefSummary: string;
  rationaleSummary: string;
  variants: CreativeGeneratedAsset[];
};

export type CreativeProvider = {
  name: CreativeProviderName;
  generateImageAssets(
    input: CreativeGenerateImageInput,
  ): Promise<CreativeGenerateImageResult>;
  regenerateImageAsset(
    input: CreativeRegenerateImageInput,
  ): Promise<CreativeGenerateImageResult>;
};

export function getRequestedCreativeProvider(): CreativeProviderName {
  return process.env.HANDI_CREATIVE_PROVIDER === "image-provider"
    ? "image-provider"
    : "mock";
}

export function toCreativeProviderMetadata(
  info: CreativeProviderInfo,
): ProviderMetadata {
  return {
    providerName: info.activeProvider,
    generationMode: info.generationMode,
    model: info.model,
    generatedAt: info.generatedAt,
    fallbackReason: info.fallbackReason,
    requestId: info.requestId,
    note: info.note,
    errorType: info.errorType || null,
    promptSummary: info.promptSummary || null,
    providerReferenceId: info.providerReferenceId || null,
    assetWidth: info.assetWidth ?? null,
    assetHeight: info.assetHeight ?? null,
    outputFormat: info.outputFormat || null,
    quality: info.quality || null,
    seed: info.seed || null,
    responseSummary: info.responseSummary || null,
  };
}

export function getCreativeProvider(
  overrideProvider?: CreativeProviderName,
): CreativeProvider {
  const requestedProvider = overrideProvider || getRequestedCreativeProvider();
  const fallback = createMockCreativeProvider({ requestedProvider });

  if (requestedProvider === "image-provider") {
    return createImageCreativeProvider({ requestedProvider, fallback });
  }

  return fallback;
}
