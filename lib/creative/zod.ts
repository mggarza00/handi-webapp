import { z } from "zod";

export const creativeAssetFormatValues = [
  "square",
  "portrait",
  "landscape",
  "story",
  "custom",
] as const;

export const creativeAdaptationMethodValues = [
  "crop",
  "pad",
  "resize",
  "ai_extend",
  "provider_regenerate",
] as const;

export const creativeAssetFormatSchema = z.enum(creativeAssetFormatValues);
export const creativeAdaptationMethodSchema = z.enum(
  creativeAdaptationMethodValues,
);
