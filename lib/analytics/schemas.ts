import { z } from "zod";

import {
  campaignGoalSchema,
  channelTypeSchema,
  providerGenerationModeSchema,
  providerNameSchema,
} from "@/lib/ai/schemas";

export const placementIdSchema = z.string().trim().min(1);

export const analyticsEventNameSchema = z.enum([
  "landing_viewed",
  "cta_clicked",
  "primary_cta_clicked",
  "secondary_cta_clicked",
  "professional_profile_viewed",
  "sign_up_started",
  "sign_up_completed",
  "login_completed",
  "request_started",
  "request_created",
  "pro_apply_started",
  "pro_apply_completed",
  "fee_checkout_started",
  "fee_paid",
  "contact_intent",
  "role_switched",
  "trust_section_viewed",
  "faq_interacted",
  "campaign_bundle_viewed",
  "creative_bundle_viewed",
  "export_package_downloaded",
  "download_bundle_downloaded",
  "request_created_confirmed",
  "pro_apply_completed_confirmed",
  "fee_paid_confirmed",
  "export_package_downloaded_confirmed",
  "download_bundle_downloaded_confirmed",
]);

export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

export const analyticsEventSourceSchema = z.enum([
  "browser",
  "server",
  "imported",
  "manual",
]);

export type AnalyticsEventSource = z.infer<typeof analyticsEventSourceSchema>;

export const analyticsProviderTargetSchema = z.enum([
  "ga4",
  "clarity",
  "internal",
]);

export type AnalyticsProviderTarget = z.infer<
  typeof analyticsProviderTargetSchema
>;

export const instrumentationDispatchStatusSchema = z.enum([
  "success",
  "skipped",
  "failed",
]);

export type InstrumentationDispatchStatus = z.infer<
  typeof instrumentationDispatchStatusSchema
>;

export const instrumentationHealthStatusSchema = z.enum([
  "healthy",
  "partial",
  "stale",
  "missing",
  "unknown",
]);

export type InstrumentationHealthStatus = z.infer<
  typeof instrumentationHealthStatusSchema
>;

export const analyticsContextSchema = z.object({
  campaign_id: z.string().trim().min(1).optional(),
  channel: z.string().trim().min(1).optional(),
  placement_id: placementIdSchema.optional(),
  message_id: z.string().trim().min(1).optional(),
  placement_copy_id: z.string().trim().min(1).optional(),
  placement_copy_source: z.string().trim().min(1).optional(),
  variant_id: z.string().trim().min(1).optional(),
  variant_name: z.string().trim().min(1).optional(),
  creative_asset_id: z.string().trim().min(1).optional(),
  derivative_asset_id: z.string().trim().min(1).optional(),
  bundle_status: z.string().trim().min(1).optional(),
  readiness_status: z.string().trim().min(1).optional(),
  provider_name: z.string().trim().min(1).optional(),
  provider_mode: z.string().trim().min(1).optional(),
  event_source: analyticsEventSourceSchema.optional(),
  event_id: z.string().trim().min(1).optional(),
  correlation_id: z.string().trim().min(1).optional(),
  utm_source: z.string().trim().min(1).optional(),
  utm_medium: z.string().trim().min(1).optional(),
  utm_campaign: z.string().trim().min(1).optional(),
  utm_content: z.string().trim().min(1).optional(),
  utm_term: z.string().trim().min(1).optional(),
});

export type AnalyticsContext = z.infer<typeof analyticsContextSchema>;

export const trackingIdentifiersSchema = z.object({
  campaignId: z.string().trim().min(1),
  campaignTitle: z.string().trim().min(1),
  goal: campaignGoalSchema,
  channel: channelTypeSchema.or(z.literal("google")),
  placementId: placementIdSchema.nullable(),
  messageId: z.string().trim().min(1).nullable(),
  placementMessageId: z.string().trim().min(1).nullable(),
  placementCopySource: z.string().trim().min(1).nullable(),
  variantId: z.string().trim().min(1).nullable(),
  variantName: z.string().trim().min(1).nullable(),
  creativeAssetId: z.string().trim().min(1).nullable(),
  derivativeAssetId: z.string().trim().min(1).nullable(),
  bundleStatus: z.string().trim().min(1).nullable(),
  readinessStatus: z.string().trim().min(1).nullable(),
  providerName: providerNameSchema.nullable(),
  providerMode: providerGenerationModeSchema.nullable(),
});

export type TrackingIdentifiers = z.infer<typeof trackingIdentifiersSchema>;

export const utmMappingSchema = z.object({
  utm_source: z.string().trim().min(1),
  utm_medium: z.string().trim().min(1),
  utm_campaign: z.string().trim().min(1),
  utm_content: z.string().trim().min(1),
  utm_term: z.string().trim().min(1).nullable(),
});

export type UtmMapping = z.infer<typeof utmMappingSchema>;

export const suggestedTrackingEventSchema = z.object({
  name: z.string().trim().min(1),
  channel: z.string().trim().min(1),
  placementId: placementIdSchema.nullable(),
  ga4Recommended: z.boolean(),
  description: z.string().trim().min(1),
});

export type SuggestedTrackingEvent = z.infer<
  typeof suggestedTrackingEventSchema
>;

export const trackingContractSchema = z.object({
  identifiers: trackingIdentifiersSchema,
  utm: utmMappingSchema,
  ga4: z.object({
    eventNamespace: z.string().trim().min(1),
    suggestedEvents: z.array(suggestedTrackingEventSchema).min(1),
    customParams: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
  }),
  clarity: z.object({
    tags: z.record(z.string(), z.string()),
    notes: z.array(z.string().trim().min(1)).min(1),
  }),
});

export type TrackingContract = z.infer<typeof trackingContractSchema>;
