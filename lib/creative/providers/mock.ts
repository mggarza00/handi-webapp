import { Resvg } from "@resvg/resvg-js";

import {
  buildCreativeRegenerationPrompt,
  buildCreativeVariantPrompt,
} from "@/lib/creative/prompts";
import type {
  CreativeGenerateImageInput,
  CreativeGenerateImageResult,
  CreativeProvider,
  CreativeProviderInfo,
  CreativeProviderName,
  CreativeRegenerateImageInput,
} from "@/lib/creative/provider";
import type { CreativeAssetFormat } from "@/lib/creative/workflow";

type CreateMockProviderOptions = {
  requestedProvider: CreativeProviderName;
};

const VARIANT_DIRECTIONS = [
  "Trust-first editorial layout with strong service cue and calm whitespace.",
  "Human-centered composition with a practical in-home or in-office context.",
  "Offer-led layout with restrained category accent and bold CTA area.",
] as const;

function formatSize(format: CreativeAssetFormat) {
  if (format === "portrait") return { width: 1080, height: 1350 };
  if (format === "landscape") return { width: 1200, height: 628 };
  if (format === "story") return { width: 1080, height: 1920 };
  if (format === "custom") return { width: 1440, height: 1080 };
  return { width: 1080, height: 1080 };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clipText(value: string, max = 64) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function summarizePrompt(prompt: string) {
  return clipText(
    prompt
      .replace(/\s+/g, " ")
      .replace(/^Create a static campaign image for Handi\.?\s*/i, "")
      .trim(),
    140,
  );
}

function renderMockVisual(args: {
  format: CreativeAssetFormat;
  headline: string;
  service: string;
  cta: string;
  direction: string;
}) {
  const { width, height } = formatSize(args.format);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2f6b" />
          <stop offset="55%" stop-color="#204ea8" />
          <stop offset="100%" stop-color="#efe6d8" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <circle cx="${width - width / 6}" cy="${height / 5}" r="${Math.max(90, width / 8)}" fill="#f4eee4" opacity="0.85" />
      <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.1)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.8)}" rx="36" fill="rgba(255,255,255,0.84)" />
      <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.16)}" width="${Math.round(width * 0.24)}" height="44" rx="22" fill="#0c1f44" />
      <text x="${Math.round(width * 0.16)}" y="${Math.round(height * 0.19)}" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#f8f4ee">Handi</text>
      <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.31)}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.05)}" font-weight="700" fill="#081221">${escapeXml(clipText(args.headline, 54))}</text>
      <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.42)}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.028)}" fill="#16305c">${escapeXml(clipText(args.service, 48))}</text>
      <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.52)}" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.021)}" fill="#2d4365">${escapeXml(clipText(args.direction, 82))}</text>
      <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.68)}" width="${Math.round(width * 0.28)}" height="58" rx="29" fill="#112a5e" />
      <text x="${Math.round(width * 0.165)}" y="${Math.round(height * 0.718)}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f8f4ee">${escapeXml(clipText(args.cta, 22))}</text>
      <rect x="${Math.round(width * 0.58)}" y="${Math.round(height * 0.23)}" width="${Math.round(width * 0.23)}" height="${Math.round(height * 0.38)}" rx="28" fill="#d9ecff" />
      <rect x="${Math.round(width * 0.63)}" y="${Math.round(height * 0.28)}" width="${Math.round(width * 0.13)}" height="${Math.round(height * 0.22)}" rx="20" fill="#f4eee4" />
      <circle cx="${Math.round(width * 0.695)}" cy="${Math.round(height * 0.315)}" r="${Math.max(34, Math.round(width * 0.03))}" fill="#0f2f6b" />
      <rect x="${Math.round(width * 0.58)}" y="${Math.round(height * 0.66)}" width="${Math.round(width * 0.23)}" height="18" rx="9" fill="#0f2f6b" opacity="0.3" />
    </svg>
  `.trim();

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return Buffer.from(resvg.render().asPng());
}

function buildProviderInfo(
  requestedProvider: CreativeProviderName,
): CreativeProviderInfo {
  return {
    requestedProvider,
    activeProvider: "mock",
    generationMode: "mock",
    status: "ready",
    model: null,
    note: "Deterministic mock image provider.",
    generatedAt: new Date().toISOString(),
    fallbackReason: null,
    requestId: null,
    errorType: null,
    outputFormat: "png",
    responseSummary: "Deterministic mock asset rendered locally.",
  };
}

function buildVariants(input: CreativeGenerateImageInput) {
  const count = Math.max(1, Math.min(input.variantCount || 3, 4));
  const headline = input.brief.briefSummary;
  const size = formatSize(input.brief.targetFormat);

  return Array.from({ length: count }).map((_, index) => {
    const label = `Variant ${String.fromCharCode(65 + index)}`;
    const direction =
      VARIANT_DIRECTIONS[index % VARIANT_DIRECTIONS.length] ||
      VARIANT_DIRECTIONS[0];
    const promptText = buildCreativeVariantPrompt({
      brief: input.brief,
      variantLabel: label,
      direction,
    });

    return {
      label,
      format: input.brief.targetFormat,
      promptText,
      rationale: `This variant leans on ${direction.toLowerCase()} while keeping the Handi trust cues and CTA hierarchy intact.`,
      mimeType: "image/png",
      buffer: renderMockVisual({
        format: input.brief.targetFormat,
        headline,
        service: input.brief.serviceCategory,
        cta: "Confia en Handi",
        direction,
      }),
      providerMetadata: {
        assetWidth: size.width,
        assetHeight: size.height,
        outputFormat: "png",
        promptSummary: summarizePrompt(promptText),
        responseSummary: `Mock creative variant ${label} rendered locally.`,
      },
    };
  });
}

export function createMockCreativeProvider(
  options: CreateMockProviderOptions,
): CreativeProvider {
  return {
    name: "mock",
    async generateImageAssets(
      input: CreativeGenerateImageInput,
    ): Promise<CreativeGenerateImageResult> {
      return {
        provider: buildProviderInfo(options.requestedProvider),
        briefSummary: input.brief.briefSummary,
        rationaleSummary: input.brief.rationaleSummary,
        variants: buildVariants(input),
      };
    },
    async regenerateImageAsset(
      input: CreativeRegenerateImageInput,
    ): Promise<CreativeGenerateImageResult> {
      const promptText = buildCreativeRegenerationPrompt({
        brief: input.brief,
        previousPrompt: input.previousPrompt,
        previousRationale: input.previousRationale,
        feedbackNote: input.feedbackNote,
      });
      const size = formatSize(input.brief.targetFormat);

      return {
        provider: buildProviderInfo(options.requestedProvider),
        briefSummary: input.brief.briefSummary,
        rationaleSummary: `${input.brief.rationaleSummary} Feedback applied: ${input.feedbackNote?.trim() || "refresh composition and emphasis."}`,
        variants: [
          {
            label: "Regenerated",
            format: input.brief.targetFormat,
            promptText,
            rationale: `The refreshed asset applies the admin feedback while preserving the original Handi brand structure and CTA clarity.${input.feedbackNote?.trim() ? ` Feedback applied: ${input.feedbackNote.trim()}.` : ""}`,
            mimeType: "image/png",
            buffer: renderMockVisual({
              format: input.brief.targetFormat,
              headline: input.brief.briefSummary,
              service: input.brief.serviceCategory,
              cta: "Tu tranquilidad va primero",
              direction:
                input.feedbackNote?.trim() ||
                "Tighter hierarchy and clearer visual focus.",
            }),
            providerMetadata: {
              assetWidth: size.width,
              assetHeight: size.height,
              outputFormat: "png",
              promptSummary: summarizePrompt(promptText),
              responseSummary: "Mock regenerated creative rendered locally.",
            },
          },
        ],
      };
    },
  };
}
