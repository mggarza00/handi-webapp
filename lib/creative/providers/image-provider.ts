import OpenAI from "openai";

import type { ProviderErrorType, ProviderMetadata } from "@/lib/ai/schemas";
import type {
  CreativeGenerateImageInput,
  CreativeGenerateImageResult,
  CreativeGeneratedAsset,
  CreativeProvider,
  CreativeProviderInfo,
  CreativeProviderName,
  CreativeRegenerateImageInput,
} from "@/lib/creative/provider";
import {
  buildCreativeRegenerationPrompt,
  buildCreativeVariantPrompt,
} from "@/lib/creative/prompts";
import { createMockCreativeProvider } from "@/lib/creative/providers/mock";
import type { CreativeAssetFormat } from "@/lib/creative/workflow";

type CreateImageCreativeProviderOptions = {
  requestedProvider: CreativeProviderName;
  fallback: CreativeProvider;
};

const VARIANT_DIRECTIONS = [
  "Trust-first editorial layout with strong service cue and calm whitespace.",
  "Human-centered composition with a practical in-home or in-office context.",
  "Offer-led layout with restrained category accent and bold CTA area.",
  "Minimalist category-led frame with generous spacing and one clear trust anchor.",
] as const;

type OpenAiImageConfig = {
  apiKey: string | null;
  model: string;
  quality: "auto" | "low" | "medium" | "high";
  background: "auto" | "opaque" | "transparent";
  moderation: "auto" | "low";
  outputFormat: "png" | "jpeg" | "webp";
};

function summarizePrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177).trim()}...`;
}

function classifyImageProviderError(error: unknown): {
  type: ProviderErrorType;
  message: string;
} {
  const message =
    error instanceof Error ? error.message : "unknown image provider error";
  const lower = message.toLowerCase();

  if (
    lower.includes("api key") ||
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.includes("incorrect api key")
  ) {
    return { type: "configuration_error", message };
  }

  if (
    lower.includes("b64_json") ||
    lower.includes("empty base64") ||
    lower.includes("without b64_json or url") ||
    lower.includes("no usable live assets") ||
    lower.includes("no usable regenerated asset") ||
    lower.includes("did not return image data") ||
    lower.includes("empty payload")
  ) {
    return { type: "response_error", message };
  }

  if (
    lower.includes("rate limit") ||
    lower.includes("timeout") ||
    lower.includes("status 5") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("fetch failed")
  ) {
    return { type: "provider_error", message };
  }

  return { type: "unknown_error", message };
}

function getImageConfig(): OpenAiImageConfig {
  return {
    apiKey:
      process.env.HANDI_CREATIVE_IMAGE_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      null,
    model: process.env.HANDI_CREATIVE_IMAGE_MODEL?.trim() || "gpt-image-1",
    quality: normalizeQuality(process.env.HANDI_CREATIVE_IMAGE_QUALITY),
    background: normalizeBackground(
      process.env.HANDI_CREATIVE_IMAGE_BACKGROUND,
    ),
    moderation: normalizeModeration(
      process.env.HANDI_CREATIVE_IMAGE_MODERATION,
    ),
    outputFormat: normalizeOutputFormat(
      process.env.HANDI_CREATIVE_IMAGE_OUTPUT_FORMAT,
    ),
  };
}

function normalizeQuality(
  value: string | undefined,
): "auto" | "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "auto";
}

function normalizeBackground(
  value: string | undefined,
): "auto" | "opaque" | "transparent" {
  if (value === "opaque" || value === "transparent") return value;
  return "auto";
}

function normalizeModeration(value: string | undefined): "auto" | "low" {
  return value === "low" ? "low" : "auto";
}

function normalizeOutputFormat(
  value: string | undefined,
): "png" | "jpeg" | "webp" {
  if (value === "jpeg" || value === "webp") return value;
  return "png";
}

function createClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

function mapFormatToSize(format: CreativeAssetFormat) {
  if (format === "portrait" || format === "story") {
    return { size: "1024x1536", width: 1024, height: 1536 } as const;
  }
  if (format === "landscape" || format === "custom") {
    return { size: "1536x1024", width: 1536, height: 1024 } as const;
  }
  return { size: "1024x1024", width: 1024, height: 1024 } as const;
}

async function decodeImagePayload(args: {
  image: Record<string, unknown>;
  defaultMimeType: string;
}) {
  const b64 =
    typeof args.image.b64_json === "string" ? args.image.b64_json : null;
  if (b64) {
    const buffer = Buffer.from(b64, "base64");
    if (!buffer.length)
      throw new Error("OpenAI returned an empty base64 image.");
    return {
      buffer,
      mimeType: args.defaultMimeType,
      revisedPrompt:
        typeof args.image.revised_prompt === "string"
          ? args.image.revised_prompt
          : null,
    };
  }

  const url = typeof args.image.url === "string" ? args.image.url : null;
  if (!url) {
    throw new Error(
      "OpenAI returned an image payload without b64_json or url.",
    );
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `OpenAI image URL download failed with status ${response.status}.`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length)
    throw new Error("OpenAI image URL returned an empty payload.");

  return {
    buffer,
    mimeType: response.headers.get("content-type") || args.defaultMimeType,
    revisedPrompt:
      typeof args.image.revised_prompt === "string"
        ? args.image.revised_prompt
        : null,
  };
}

function buildFallbackProviderInfo(args: {
  result: CreativeGenerateImageResult;
  requestedProvider: CreativeProviderName;
  model: string;
  reason: string;
  errorType: ProviderErrorType;
}) {
  return {
    ...args.result.provider,
    requestedProvider: args.requestedProvider,
    activeProvider: "mock",
    generationMode: "fallback",
    status: "fallback",
    model: args.model,
    fallbackReason: args.reason,
    errorType: args.errorType,
    note: "Mock provider used after image-provider fallback.",
    promptSummary:
      args.result.variants[0]?.providerMetadata?.promptSummary || null,
    responseSummary: args.reason,
  } satisfies CreativeProviderInfo;
}

function withFallbackVariants(
  variants: CreativeGeneratedAsset[],
  args: { model: string; reason: string; errorType: ProviderErrorType },
) {
  return variants.map((variant) => ({
    ...variant,
    providerMetadata: {
      ...(variant.providerMetadata || {}),
      model: args.model,
      fallbackReason: args.reason,
      errorType: args.errorType,
      promptSummary:
        typeof variant.promptText === "string"
          ? summarizePrompt(variant.promptText)
          : null,
      responseSummary:
        (variant.providerMetadata?.responseSummary as
          | string
          | null
          | undefined) || "Mock creative used after live-provider fallback.",
    } satisfies Partial<ProviderMetadata>,
  }));
}

async function runFallback(args: {
  fallback: CreativeProvider;
  requestedProvider: CreativeProviderName;
  model: string;
  reason: string;
  errorType: ProviderErrorType;
  input: CreativeGenerateImageInput | CreativeRegenerateImageInput;
  isRegeneration: boolean;
}) {
  const result = args.isRegeneration
    ? await args.fallback.regenerateImageAsset(
        args.input as CreativeRegenerateImageInput,
      )
    : await args.fallback.generateImageAssets(
        args.input as CreativeGenerateImageInput,
      );

  return {
    ...result,
    provider: buildFallbackProviderInfo({
      result,
      requestedProvider: args.requestedProvider,
      model: args.model,
      reason: args.reason,
      errorType: args.errorType,
    }),
    variants: withFallbackVariants(result.variants, {
      model: args.model,
      reason: args.reason,
      errorType: args.errorType,
    }),
  };
}

async function generateLiveVariant(args: {
  client: OpenAI;
  model: string;
  quality: OpenAiImageConfig["quality"];
  background: OpenAiImageConfig["background"];
  moderation: OpenAiImageConfig["moderation"];
  outputFormat: OpenAiImageConfig["outputFormat"];
  prompt: string;
  label: string;
  format: CreativeAssetFormat;
  rationale: string;
  requestedProvider: CreativeProviderName;
}) {
  const dimensions = mapFormatToSize(args.format);
  const imageResponse = await args.client.images.generate({
    model: args.model,
    prompt: args.prompt,
    n: 1,
    size: dimensions.size,
    quality: args.quality,
    output_format: args.outputFormat,
    background: args.background,
    moderation: args.moderation,
  });

  const data = Array.isArray(imageResponse.data) ? imageResponse.data[0] : null;
  if (!data || typeof data !== "object") {
    throw new Error("OpenAI did not return image data.");
  }

  const decoded = await decodeImagePayload({
    image: data as Record<string, unknown>,
    defaultMimeType: `image/${args.outputFormat}`,
  });
  const requestId =
    (imageResponse as unknown as { _request_id?: string | null })._request_id ||
    (imageResponse as unknown as { request_id?: string | null }).request_id ||
    null;

  return {
    provider: {
      requestedProvider: args.requestedProvider,
      activeProvider: "openai",
      generationMode: "live",
      status: "ready",
      model: args.model,
      note: "OpenAI live image generation completed.",
      generatedAt: new Date().toISOString(),
      fallbackReason: null,
      requestId,
      errorType: null,
      promptSummary: summarizePrompt(args.prompt),
      providerReferenceId: requestId,
      assetWidth: dimensions.width,
      assetHeight: dimensions.height,
      outputFormat: args.outputFormat,
      quality: args.quality,
      responseSummary:
        typeof decoded.revisedPrompt === "string" &&
        decoded.revisedPrompt.trim()
          ? `OpenAI revised prompt applied.`
          : "OpenAI image generation completed successfully.",
    } satisfies CreativeProviderInfo,
    asset: {
      label: args.label,
      format: args.format,
      promptText: decoded.revisedPrompt?.trim() || args.prompt,
      rationale: args.rationale,
      mimeType: decoded.mimeType,
      buffer: decoded.buffer,
      providerMetadata: {
        providerName: "openai",
        generationMode: "live",
        model: args.model,
        generatedAt: new Date().toISOString(),
        fallbackReason: null,
        requestId,
        note: "OpenAI live image generation completed.",
        errorType: null,
        promptSummary: summarizePrompt(args.prompt),
        providerReferenceId: requestId,
        assetWidth: dimensions.width,
        assetHeight: dimensions.height,
        outputFormat: args.outputFormat,
        quality: args.quality,
        responseSummary:
          typeof decoded.revisedPrompt === "string" &&
          decoded.revisedPrompt.trim()
            ? `Revised prompt used by OpenAI for ${args.label}.`
            : `OpenAI image generated for ${args.label}.`,
      } satisfies Partial<ProviderMetadata>,
    } satisfies CreativeGeneratedAsset,
  };
}

async function generateLiveAssets(args: {
  client: OpenAI;
  config: OpenAiImageConfig;
  input: CreativeGenerateImageInput;
  requestedProvider: CreativeProviderName;
}) {
  const count = Math.max(1, Math.min(args.input.variantCount || 3, 4));
  const results: Array<Awaited<ReturnType<typeof generateLiveVariant>>> = [];

  for (let index = 0; index < count; index += 1) {
    const label = `Variant ${String.fromCharCode(65 + index)}`;
    const direction =
      VARIANT_DIRECTIONS[index % VARIANT_DIRECTIONS.length] ||
      VARIANT_DIRECTIONS[0];
    const prompt = buildCreativeVariantPrompt({
      brief: args.input.brief,
      variantLabel: label,
      direction,
    });
    const rationale = `This live variant leans on ${direction.toLowerCase()} while preserving Handi trust cues, restrained text, and a clear CTA hierarchy.`;

    results.push(
      await generateLiveVariant({
        client: args.client,
        model: args.config.model,
        quality: args.config.quality,
        background: args.config.background,
        moderation: args.config.moderation,
        outputFormat: args.config.outputFormat,
        prompt,
        label,
        format: args.input.brief.targetFormat,
        rationale,
        requestedProvider: args.requestedProvider,
      }),
    );
  }

  return {
    provider: results[0]?.provider || null,
    variants: results.map((result) => result.asset),
  };
}

async function regenerateLiveAsset(args: {
  client: OpenAI;
  config: OpenAiImageConfig;
  input: CreativeRegenerateImageInput;
  requestedProvider: CreativeProviderName;
}) {
  const prompt = buildCreativeRegenerationPrompt({
    brief: args.input.brief,
    previousPrompt: args.input.previousPrompt,
    previousRationale: args.input.previousRationale,
    feedbackNote: args.input.feedbackNote,
  });
  const rationale = `The refreshed live asset applies the admin feedback while preserving Handi brand direction, restrained overlay text, and the original campaign intent.${args.input.feedbackNote?.trim() ? ` Feedback applied: ${args.input.feedbackNote.trim()}.` : ""}`;

  const result = await generateLiveVariant({
    client: args.client,
    model: args.config.model,
    quality: args.config.quality,
    background: args.config.background,
    moderation: args.config.moderation,
    outputFormat: args.config.outputFormat,
    prompt,
    label: "Regenerated",
    format: args.input.brief.targetFormat,
    rationale,
    requestedProvider: args.requestedProvider,
  });

  return {
    provider: result.provider,
    variants: [result.asset],
  };
}

export function createImageCreativeProvider(
  options: CreateImageCreativeProviderOptions,
): CreativeProvider {
  const fallback =
    options.fallback ||
    createMockCreativeProvider({
      requestedProvider: options.requestedProvider,
    });
  const config = getImageConfig();

  return {
    name: "image-provider",
    async generateImageAssets(
      input: CreativeGenerateImageInput,
    ): Promise<CreativeGenerateImageResult> {
      if (!config.apiKey) {
        return runFallback({
          fallback,
          requestedProvider: options.requestedProvider,
          model: config.model,
          reason:
            "HANDI_CREATIVE_IMAGE_API_KEY or OPENAI_API_KEY is missing, using the mock image provider.",
          errorType: "configuration_error",
          input,
          isRegeneration: false,
        });
      }

      try {
        const live = await generateLiveAssets({
          client: createClient(config.apiKey),
          config,
          input,
          requestedProvider: options.requestedProvider,
        });

        if (!live.provider || !live.variants.length) {
          throw new Error("Image provider returned no usable live assets.");
        }

        return {
          provider: live.provider,
          briefSummary: input.brief.briefSummary,
          rationaleSummary: input.brief.rationaleSummary,
          variants: live.variants,
        };
      } catch (error) {
        const classified = classifyImageProviderError(error);
        console.error(
          "[creative][image-provider] generateImageAssets",
          classified.message,
        );
        return runFallback({
          fallback,
          requestedProvider: options.requestedProvider,
          model: config.model,
          reason: `Live image generation failed: ${classified.message}`,
          errorType: classified.type,
          input,
          isRegeneration: false,
        });
      }
    },
    async regenerateImageAsset(
      input: CreativeRegenerateImageInput,
    ): Promise<CreativeGenerateImageResult> {
      if (!config.apiKey) {
        return runFallback({
          fallback,
          requestedProvider: options.requestedProvider,
          model: config.model,
          reason:
            "HANDI_CREATIVE_IMAGE_API_KEY or OPENAI_API_KEY is missing, using the mock image provider for regeneration.",
          errorType: "configuration_error",
          input,
          isRegeneration: true,
        });
      }

      try {
        const live = await regenerateLiveAsset({
          client: createClient(config.apiKey),
          config,
          input,
          requestedProvider: options.requestedProvider,
        });

        if (!live.provider || !live.variants.length) {
          throw new Error(
            "Image provider returned no usable regenerated asset.",
          );
        }

        return {
          provider: live.provider,
          briefSummary: input.brief.briefSummary,
          rationaleSummary: `${input.brief.rationaleSummary} Feedback applied: ${input.feedbackNote?.trim() || "refresh composition and emphasis."}`,
          variants: live.variants,
        };
      } catch (error) {
        const classified = classifyImageProviderError(error);
        console.error(
          "[creative][image-provider] regenerateImageAsset",
          classified.message,
        );
        return runFallback({
          fallback,
          requestedProvider: options.requestedProvider,
          model: config.model,
          reason: `Live image regeneration failed: ${classified.message}`,
          errorType: classified.type,
          input,
          isRegeneration: true,
        });
      }
    },
  };
}
