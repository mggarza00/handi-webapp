import sharp from "sharp";

import type { ProviderMetadata } from "@/lib/ai/schemas";
import {
  describeCreativeFormatTarget,
  getChannelSuitabilityForFormat,
  resolveCreativeTargetDimensions,
} from "@/lib/creative/formats";
import type {
  CreativeAdaptationMethod,
  CreativeAssetFormat,
} from "@/lib/creative/workflow";
import type { PublishChannel } from "@/lib/campaigns/workflow";

type AdaptCreativeAssetInput = {
  sourceBuffer: Buffer;
  sourceFormat: CreativeAssetFormat;
  sourceLabel: string;
  targetFormat: CreativeAssetFormat;
  targetChannel?: PublishChannel | null;
  width?: number | null;
  height?: number | null;
  adaptationMethod?: CreativeAdaptationMethod | null;
  feedbackNote?: string | null;
};

export type CreativeAdaptationResult = {
  buffer: Buffer;
  mimeType: string;
  targetFormat: CreativeAssetFormat;
  width: number;
  height: number;
  adaptationMethod: CreativeAdaptationMethod;
  providerMetadata: ProviderMetadata;
  rationale: string;
  promptText: string;
  summary: string;
  channelSuitability: PublishChannel[];
};

function resolveMethod(args: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  requestedMethod?: CreativeAdaptationMethod | null;
}) {
  if (args.requestedMethod === "crop") return "crop" as const;
  if (args.requestedMethod === "pad") return "pad" as const;
  if (args.requestedMethod === "resize") return "resize" as const;
  if (
    args.requestedMethod === "ai_extend" ||
    args.requestedMethod === "provider_regenerate"
  ) {
    return "pad" as const;
  }

  const sourceRatio = args.sourceWidth / args.sourceHeight;
  const targetRatio = args.targetWidth / args.targetHeight;
  const delta = Math.abs(sourceRatio - targetRatio);

  if (delta < 0.04) return "resize" as const;
  if (targetRatio < sourceRatio && sourceRatio - targetRatio > 0.2) {
    return "pad" as const;
  }
  return "crop" as const;
}

function buildAdaptationRationale(args: {
  method: CreativeAdaptationMethod;
  label: string;
  targetLabel: string;
  feedbackNote?: string | null;
}) {
  const base =
    args.method === "crop"
      ? "The derivative keeps the core subject prominent by cropping around the strongest visual focus."
      : args.method === "pad"
        ? "The derivative preserves the full composition and adds safe space to fit the new format."
        : "The derivative keeps the composition intact with a controlled resize to the target frame.";

  if (args.feedbackNote?.trim()) {
    return `${base} Admin adaptation note: ${args.feedbackNote.trim()}`;
  }

  return `${base} This version adapts ${args.label} into ${args.targetLabel}.`;
}

function buildAdaptationPrompt(args: {
  sourceLabel: string;
  targetLabel: string;
  targetChannel?: PublishChannel | null;
  method: CreativeAdaptationMethod;
  feedbackNote?: string | null;
}) {
  return [
    `Adapt approved master asset "${args.sourceLabel}" into ${args.targetLabel}.`,
    args.targetChannel ? `Suggested channel: ${args.targetChannel}.` : "",
    `Method: ${args.method}.`,
    args.feedbackNote?.trim()
      ? `Admin note: ${args.feedbackNote.trim()}`
      : "Preserve brand trust cues, CTA readability, and visual hierarchy.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function adaptCreativeAsset(
  input: AdaptCreativeAssetInput,
): Promise<CreativeAdaptationResult> {
  const source = sharp(input.sourceBuffer);
  const sourceMeta = await source.metadata();
  const sourceWidth = sourceMeta.width || 1080;
  const sourceHeight = sourceMeta.height || 1080;
  const target = resolveCreativeTargetDimensions({
    format: input.targetFormat,
    width: input.width,
    height: input.height,
  });
  const method = resolveMethod({
    sourceWidth,
    sourceHeight,
    targetWidth: target.width,
    targetHeight: target.height,
    requestedMethod: input.adaptationMethod,
  });

  let pipeline = sharp(input.sourceBuffer).flatten({
    background: "#f8f4ee",
  });

  if (method === "crop") {
    pipeline = pipeline.resize(target.width, target.height, {
      fit: "cover",
      position: "attention",
    });
  } else if (method === "pad") {
    pipeline = pipeline.resize(target.width, target.height, {
      fit: "contain",
      background: "#f8f4ee",
      position: "center",
    });
  } else {
    pipeline = pipeline.resize(target.width, target.height, {
      fit: "fill",
    });
  }

  const buffer = await pipeline.png().toBuffer();
  const targetLabel = describeCreativeFormatTarget({
    format: input.targetFormat,
    width: target.width,
    height: target.height,
  });
  const promptText = buildAdaptationPrompt({
    sourceLabel: input.sourceLabel,
    targetLabel,
    targetChannel: input.targetChannel,
    method,
    feedbackNote: input.feedbackNote,
  });
  const note =
    input.adaptationMethod === "ai_extend" ||
    input.adaptationMethod === "provider_regenerate"
      ? `Requested ${input.adaptationMethod} but executed ${method} locally in this phase.`
      : `Adapted locally with ${method}.`;

  return {
    buffer,
    mimeType: "image/png",
    targetFormat: input.targetFormat,
    width: target.width,
    height: target.height,
    adaptationMethod: method,
    channelSuitability: getChannelSuitabilityForFormat(
      input.targetFormat,
      input.targetChannel,
    ),
    summary: `Derived ${targetLabel} from ${input.sourceLabel}.`,
    promptText,
    rationale: buildAdaptationRationale({
      method,
      label: input.sourceLabel,
      targetLabel,
      feedbackNote: input.feedbackNote,
    }),
    providerMetadata: {
      providerName: "local-adapter",
      generationMode: "live",
      model: null,
      generatedAt: new Date().toISOString(),
      fallbackReason: null,
      requestId: null,
      note,
      errorType: null,
      promptSummary: targetLabel,
      assetWidth: target.width,
      assetHeight: target.height,
      outputFormat: "png",
      quality: null,
      seed: null,
      responseSummary: `Local ${method} adaptation generated with Sharp.`,
      providerReferenceId: null,
    },
  };
}
