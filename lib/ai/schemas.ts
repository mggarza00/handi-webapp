import { z } from "zod";

export const audienceTypes = ["client", "professional", "business"] as const;
export const campaignGoals = [
  "awareness",
  "acquisition",
  "activation",
  "conversion",
  "retention",
  "reactivation",
  "upsell",
  "referral",
  "education",
] as const;
export const channelTypes = [
  "meta",
  "email",
  "whatsapp",
  "push",
  "landing",
] as const;
export const contentFormats = [
  "meta-ad",
  "email",
  "whatsapp-message",
  "push-notification",
  "landing-copy",
  "campaign-brief",
] as const;

export type AudienceType = (typeof audienceTypes)[number];
export type CampaignGoal = (typeof campaignGoals)[number];
export type ChannelType = (typeof channelTypes)[number];
export type ContentFormat = (typeof contentFormats)[number];

export const providerNames = ["mock", "openai"] as const;
export const providerGenerationModes = ["mock", "live", "fallback"] as const;

export type ProviderName = (typeof providerNames)[number];
export type ProviderGenerationMode = (typeof providerGenerationModes)[number];

export const audienceTypeSchema = z.enum(audienceTypes);
export const campaignGoalSchema = z.enum(campaignGoals);
export const channelTypeSchema = z.enum(channelTypes);
export const contentFormatSchema = z.enum(contentFormats);
export const providerNameSchema = z.enum(providerNames);
export const providerGenerationModeSchema = z.enum(providerGenerationModes);

export const DEFAULT_FORMAT_BY_CHANNEL: Record<ChannelType, ContentFormat> = {
  meta: "meta-ad",
  email: "email",
  whatsapp: "whatsapp-message",
  push: "push-notification",
  landing: "landing-copy",
};

export const brandContextSchema = z.object({
  brandName: z.literal("Handi"),
  audience: audienceTypeSchema,
  goal: campaignGoalSchema,
  channel: channelTypeSchema.nullable(),
  serviceCategory: z.string().min(1),
  offer: z.string().min(1),
  cta: z.string().min(1),
  essence: z.string().min(1),
  positioning: z.string().min(1),
  mission: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
  voiceSummary: z.array(z.string().min(1)).min(1),
  languageRules: z.array(z.string().min(1)).min(1),
  doList: z.array(z.string().min(1)).min(1),
  dontList: z.array(z.string().min(1)).min(1),
  approvedClaims: z.array(z.string().min(1)).min(1),
  cautionClaims: z.array(z.string().min(1)),
  prohibitedClaims: z.array(z.string().min(1)).min(1),
  audienceInsights: z.object({
    label: z.string().min(1),
    summary: z.string().min(1),
    jobsToBeDone: z.array(z.string().min(1)).min(1),
    trustTriggers: z.array(z.string().min(1)).min(1),
    objections: z.array(z.string().min(1)).min(1),
  }),
  channelRules: z.object({
    purpose: z.string().min(1),
    style: z.array(z.string().min(1)).min(1),
    doList: z.array(z.string().min(1)).min(1),
    dontList: z.array(z.string().min(1)).min(1),
    ctaRules: z.array(z.string().min(1)).min(1),
  }),
  contentPillars: z.array(z.string().min(1)).min(1),
  visualRules: z.object({
    palette: z.array(z.string().min(1)).min(1),
    typography: z.array(z.string().min(1)).min(1),
    artDirection: z.array(z.string().min(1)).min(1),
    iconography: z.array(z.string().min(1)).min(1),
  }),
});

export type BrandContext = z.infer<typeof brandContextSchema>;

export const contentGenerationInputSchema = z.object({
  title: z.string().trim().max(120).optional(),
  sourceCampaignDraftId: z.string().uuid().optional(),
  audience: audienceTypeSchema,
  goal: campaignGoalSchema,
  channel: channelTypeSchema,
  format: contentFormatSchema,
  serviceCategory: z.string().trim().min(1),
  offer: z.string().trim().min(1),
  cta: z.string().trim().min(1),
  tonePreference: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type ContentGenerationInput = z.infer<
  typeof contentGenerationInputSchema
>;

export const providerMetadataSchema = z.object({
  providerName: providerNameSchema,
  generationMode: providerGenerationModeSchema,
  model: z.string().trim().min(1).nullable(),
  generatedAt: z.string().min(1),
  fallbackReason: z.string().trim().min(1).nullable(),
  requestId: z.string().trim().min(1).nullable(),
  note: z.string().trim().min(1).nullable(),
});

export type ProviderMetadata = z.infer<typeof providerMetadataSchema>;

export const messageRationaleSchema = z.object({
  angle: z.string().min(1),
  audienceIntent: z.string().min(1),
  whyChannel: z.string().min(1),
  whyCta: z.string().min(1),
  note: z.string().min(1).nullable().optional(),
  summary: z.string().min(1),
});

export type MessageRationale = z.infer<typeof messageRationaleSchema>;

export const llmGeneratedVariantSchema = z.object({
  label: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  rationale: messageRationaleSchema,
  hooks: z.array(z.string().min(1)).max(3).optional().default([]),
});

export type LlmGeneratedVariant = z.infer<typeof llmGeneratedVariantSchema>;

export const llmContentPackageSchema = z.object({
  recommendedAngle: z.string().min(1),
  rationaleSummary: z.string().min(1),
  feedbackApplied: z.string().min(1).nullable().optional(),
  variants: z.array(llmGeneratedVariantSchema).min(1).max(3),
});

export type LlmContentPackage = z.infer<typeof llmContentPackageSchema>;

export const generatedMessageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  channel: channelTypeSchema,
  format: contentFormatSchema,
  angle: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  rationale: z.string().min(1),
  prompt: z.string().min(1),
  guardrailsApplied: z.array(z.string().min(1)).min(1),
  providerMetadata: providerMetadataSchema,
});

export type GeneratedMessage = z.infer<typeof generatedMessageSchema>;

export const journeyStepSchema = z.object({
  step: z.number().int().positive(),
  channel: channelTypeSchema,
  purpose: z.string().min(1),
  timing: z.string().min(1),
  format: contentFormatSchema,
  trigger: z.string().min(1),
});

export type JourneyStep = z.infer<typeof journeyStepSchema>;

export const kpiSuggestionSchema = z.object({
  metric: z.string().min(1),
  whyItMatters: z.string().min(1),
  targetSignal: z.string().min(1),
});

export type KpiSuggestion = z.infer<typeof kpiSuggestionSchema>;

export const campaignGenerationInputSchema = z.object({
  title: z.string().trim().max(120).optional(),
  sourceCampaignDraftId: z.string().uuid().optional(),
  audience: audienceTypeSchema,
  goal: campaignGoalSchema,
  channels: z.array(channelTypeSchema).min(1),
  serviceCategory: z.string().trim().min(1),
  offer: z.string().trim().min(1),
  cta: z.string().trim().min(1),
  journeyTrigger: z.string().trim().min(1),
  tonePreference: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type CampaignGenerationInput = z.infer<
  typeof campaignGenerationInputSchema
>;

export const campaignDraftSchema = z.object({
  campaignName: z.string().min(1),
  audience: audienceTypeSchema,
  goal: campaignGoalSchema,
  channels: z.array(channelTypeSchema).min(1),
  serviceCategory: z.string().min(1),
  offer: z.string().min(1),
  cta: z.string().min(1),
  trigger: z.string().min(1),
  recommendedAngle: z.string().min(1),
  brandContext: brandContextSchema,
  channelPlan: z.array(journeyStepSchema).min(1),
  messageSuggestions: z.array(generatedMessageSchema).min(1),
  kpiSuggestions: z.array(kpiSuggestionSchema).min(1),
  guardrailsApplied: z.array(z.string().min(1)).min(1),
});

export type CampaignDraft = z.infer<typeof campaignDraftSchema>;
