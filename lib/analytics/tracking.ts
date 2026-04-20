"use client";

import {
  getAttributionEventPayload,
  getCampaignContextPayload,
} from "@/lib/analytics/attribution";
import { setClarityTags, trackClarityEvent } from "@/lib/analytics/clarity";
import { trackGa4Event, trackGa4PageView } from "@/lib/analytics/ga4";
import type {
  AnalyticsContext,
  AnalyticsEventName,
  TrackingIdentifiers,
} from "@/lib/analytics/schemas";

export type AnalyticsParamValue = string | number | boolean | null | undefined;

export type AnalyticsEventParams = Record<string, AnalyticsParamValue>;

type PageViewPayload = {
  pagePath: string;
  pageTitle?: string;
  pageLocation?: string;
};

function sanitizeValue(value: AnalyticsParamValue) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return value ?? null;
}

function sanitizeParams(
  params: AnalyticsEventParams,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      const normalized = sanitizeValue(value);
      if (normalized === null) return [];
      return [[key, normalized]];
    }),
  );
}

function buildClarityTagsFromParams(params: AnalyticsEventParams) {
  const clarityKeys = {
    campaign_id: "handi_campaign_id",
    channel: "handi_channel",
    placement_id: "handi_placement_id",
    message_id: "handi_message_id",
    creative_asset_id: "handi_creative_asset_id",
    derivative_asset_id: "handi_derivative_asset_id",
    bundle_status: "handi_bundle_status",
    readiness_status: "handi_readiness_status",
    utm_campaign: "handi_utm_campaign",
    utm_source: "handi_utm_source",
    utm_medium: "handi_utm_medium",
  } as const satisfies Partial<Record<keyof AnalyticsContext, string>>;

  return Object.fromEntries(
    Object.entries(clarityKeys).flatMap(([key, clarityKey]) => {
      const value = sanitizeValue(params[key]);
      return value === null ? [] : [[clarityKey, value]];
    }),
  );
}

export function mapTrackingIdentifiersToAnalyticsParams(
  identifiers: Partial<TrackingIdentifiers>,
): AnalyticsEventParams {
  return {
    campaign_id: identifiers.campaignId,
    channel: identifiers.channel,
    placement_id: identifiers.placementId,
    message_id: identifiers.messageId,
    variant_id: identifiers.variantId || identifiers.variantName,
    variant_name: identifiers.variantName,
    creative_asset_id: identifiers.creativeAssetId,
    derivative_asset_id: identifiers.derivativeAssetId,
    bundle_status: identifiers.bundleStatus,
    readiness_status: identifiers.readinessStatus,
    provider_name: identifiers.providerName,
    provider_mode: identifiers.providerMode,
  };
}

function buildBasePayload(params: AnalyticsEventParams = {}) {
  return sanitizeParams({
    ...getAttributionEventPayload(),
    ...getCampaignContextPayload(),
    ...params,
  });
}

export function trackPageView(payload: PageViewPayload): void {
  if (typeof window === "undefined") return;
  const params = buildBasePayload({
    page_path: payload.pagePath,
    page_title: payload.pageTitle || document.title,
    page_location: payload.pageLocation || window.location.href,
  });
  trackGa4PageView({
    page_path: params.page_path as string,
    page_title:
      typeof params.page_title === "string" ? params.page_title : undefined,
    page_location:
      typeof params.page_location === "string"
        ? params.page_location
        : undefined,
  });
  setClarityTags({
    ...buildClarityTagsFromParams(params),
    handi_page_path: params.page_path,
    handi_page_title: params.page_title,
  });
}

export function trackAnalyticsEvent(
  name: AnalyticsEventName,
  params: AnalyticsEventParams = {},
): void {
  if (typeof window === "undefined") return;
  const payload = buildBasePayload(params);
  trackGa4Event(name, payload);
  trackClarityEvent(name);
  setClarityTags(buildClarityTagsFromParams(payload));
}

export function trackCampaignEvent(
  name: AnalyticsEventName,
  identifiers: Partial<TrackingIdentifiers>,
  params: AnalyticsEventParams = {},
): void {
  trackAnalyticsEvent(name, {
    ...mapTrackingIdentifiersToAnalyticsParams(identifiers),
    ...params,
  });
}
