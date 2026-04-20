import { z } from "zod";

import { channelTypeSchema } from "@/lib/ai/schemas";
import {
  creativeAdaptationMethodSchema,
  creativeAssetFormatSchema,
} from "@/lib/creative/zod";

export const creativeBriefInputSchema = z.object({
  campaignDraftId: z.string().uuid(),
  campaignMessageId: z.string().uuid().optional().nullable(),
  channel: z.union([channelTypeSchema, z.literal("google")]),
  format: creativeAssetFormatSchema.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const creativeGenerateInputSchema = creativeBriefInputSchema.extend({
  variantCount: z.coerce.number().int().min(1).max(4).optional(),
  redirectTo: z.string().optional(),
});

export const creativeRegenerateInputSchema = z.object({
  creativeAssetId: z.string().uuid(),
  feedbackNote: z.string().trim().max(2000).optional().nullable(),
  redirectTo: z.string().optional(),
});

export const creativeAdaptInputSchema = z.object({
  sourceCreativeAssetId: z.string().uuid(),
  targetChannel: z
    .union([channelTypeSchema, z.literal("google")])
    .optional()
    .nullable(),
  format: creativeAssetFormatSchema,
  width: z.coerce.number().int().positive().max(4096).optional().nullable(),
  height: z.coerce.number().int().positive().max(4096).optional().nullable(),
  adaptationMethod: creativeAdaptationMethodSchema.optional().nullable(),
  feedbackNote: z.string().trim().max(2000).optional().nullable(),
  redirectTo: z.string().optional(),
});

export const creativeAdaptRegenerateInputSchema = z.object({
  creativeAssetId: z.string().uuid(),
  targetChannel: z
    .union([channelTypeSchema, z.literal("google")])
    .optional()
    .nullable(),
  format: creativeAssetFormatSchema.optional().nullable(),
  width: z.coerce.number().int().positive().max(4096).optional().nullable(),
  height: z.coerce.number().int().positive().max(4096).optional().nullable(),
  adaptationMethod: creativeAdaptationMethodSchema.optional().nullable(),
  feedbackNote: z.string().trim().max(2000).optional().nullable(),
  redirectTo: z.string().optional(),
});
