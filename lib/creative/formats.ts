import type { PublishChannel } from "@/lib/campaigns/workflow";
import type {
  CreativeAdaptationMethod,
  CreativeAssetFormat,
} from "@/lib/creative/workflow";

export type CreativeFormatPreset = {
  format: CreativeAssetFormat;
  label: string;
  width: number;
  height: number;
  defaultMethod: CreativeAdaptationMethod;
  recommendedChannels: PublishChannel[];
  description: string;
};

const PRESETS: Record<CreativeAssetFormat, CreativeFormatPreset> = {
  square: {
    format: "square",
    label: "Square",
    width: 1080,
    height: 1080,
    defaultMethod: "crop",
    recommendedChannels: ["meta", "push"],
    description: "Balanced square asset for feed and compact placements.",
  },
  portrait: {
    format: "portrait",
    label: "Portrait",
    width: 1080,
    height: 1350,
    defaultMethod: "crop",
    recommendedChannels: ["meta", "whatsapp"],
    description: "Taller feed composition with room for subject and CTA.",
  },
  landscape: {
    format: "landscape",
    label: "Landscape",
    width: 1200,
    height: 628,
    defaultMethod: "crop",
    recommendedChannels: ["email", "landing", "google"],
    description: "Wide asset for headers, landing heroes, and export payloads.",
  },
  story: {
    format: "story",
    label: "Story",
    width: 1080,
    height: 1920,
    defaultMethod: "pad",
    recommendedChannels: ["whatsapp", "meta"],
    description: "Tall immersive format with safer padding defaults.",
  },
  custom: {
    format: "custom",
    label: "Custom",
    width: 1440,
    height: 1080,
    defaultMethod: "resize",
    recommendedChannels: [],
    description:
      "Custom adaptation when the target channel needs exact dimensions.",
  },
};

const DEFAULT_FORMAT_BY_CHANNEL: Record<PublishChannel, CreativeAssetFormat> = {
  meta: "square",
  email: "landscape",
  whatsapp: "portrait",
  push: "square",
  landing: "landscape",
  google: "landscape",
};

export function listCreativeFormatPresets() {
  return Object.values(PRESETS);
}

export function getCreativeFormatPreset(
  format: CreativeAssetFormat,
): CreativeFormatPreset {
  return PRESETS[format];
}

export function getDefaultCreativeFormatForChannel(channel: PublishChannel) {
  return DEFAULT_FORMAT_BY_CHANNEL[channel];
}

export function resolveCreativeTargetDimensions(args: {
  format: CreativeAssetFormat;
  width?: number | null;
  height?: number | null;
}) {
  if (
    args.format === "custom" &&
    typeof args.width === "number" &&
    typeof args.height === "number" &&
    args.width > 0 &&
    args.height > 0
  ) {
    return {
      width: Math.round(args.width),
      height: Math.round(args.height),
      preset: PRESETS.custom,
    };
  }

  const preset = getCreativeFormatPreset(args.format);
  return {
    width: preset.width,
    height: preset.height,
    preset,
  };
}

export function getChannelSuitabilityForFormat(
  format: CreativeAssetFormat,
  targetChannel?: PublishChannel | null,
) {
  const preset = getCreativeFormatPreset(format);
  const items = new Set<PublishChannel>(preset.recommendedChannels);
  if (targetChannel) {
    items.add(targetChannel);
  }
  return Array.from(items);
}

export function describeCreativeFormatTarget(args: {
  format: CreativeAssetFormat;
  width: number;
  height: number;
}) {
  return `${getCreativeFormatPreset(args.format).label} ${args.width}x${args.height}`;
}
