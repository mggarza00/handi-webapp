"use client";

import { getAttributionEventPayload } from "@/lib/analytics/attribution";
import { buildConversionPayload } from "@/lib/analytics/conversions";

type EventParams = Record<string, string | number | boolean | null | undefined>;

type DataLayerPayload = {
  event: string;
} & EventParams;

declare global {
  interface Window {
    dataLayer?: DataLayerPayload[];
  }
}

export function trackEvent(name: string, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer || [];
    const attributionParams = getAttributionEventPayload();
    window.dataLayer.push({
      event: name,
      ...attributionParams,
      ...params,
    });
  } catch {
    // No-op: tracking must never break UI.
  }
}

export function trackSignUpStarted(params: {
  method: "email" | "google" | "unknown";
  source_page?: string;
}): void {
  trackEvent("sign_up_started", params);
}

export function trackSignUpCompleted(params: {
  method: "email" | "google" | "unknown";
  user_type?: "client" | "pro" | "admin" | "unknown";
  source_page?: string;
  pending_email_confirmation?: boolean;
}): void {
  trackEvent("sign_up_completed", params);
}

export function trackLoginCompleted(params: {
  method: "email" | "google" | "unknown";
  user_type?: "client" | "pro" | "admin" | "unknown";
  source_page?: string;
}): void {
  trackEvent("login_completed", params);
}

export function trackRequestCreateStarted(params: {
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
}): void {
  trackEvent("request_create_started", params);
}

export function trackRequestCreated(params: {
  request_id?: string;
  service_category?: string;
  service_subcategory?: string;
  city?: string;
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
}): void {
  trackEvent(
    "request_created",
    buildConversionPayload("request_created", params),
  );
}

export function trackProfessionalProfileViewed(params: {
  profile_id: string;
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
}): void {
  trackEvent("professional_profile_viewed", params);
}

export function trackProApplyStarted(params: {
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
}): void {
  trackEvent("pro_apply_started", params);
}

export function trackProApplySubmitted(params: {
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
  service_category?: string;
  city?: string;
}): void {
  trackEvent(
    "pro_apply_submitted",
    buildConversionPayload("pro_apply_submitted", params),
  );
}

export function trackContactIntent(params: {
  event_id?: string;
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
  request_id?: string;
  profile_id?: string;
  conversation_id?: string;
  service_category?: string;
  service_subcategory?: string;
  city?: string;
  placement?: string;
}): void {
  trackEvent(
    "contact_intent",
    buildConversionPayload("contact_intent", {
      ...params,
      intent_channel: "chat_start",
    }),
  );
}

export function trackRoleSwitched(params: {
  source_page?: string;
  origin_role?: "client" | "pro" | "admin" | "unknown";
  destination_role: "client" | "pro" | "admin";
}): void {
  trackEvent("role_switched", params);
}

export function trackLocalLandingViewed(params: {
  landing_type: "service" | "city" | "service_city";
  service_slug?: string;
  city_slug?: string;
  source_page?: string;
}): void {
  trackEvent("local_landing_viewed", params);
}

export function trackLocalLandingCtaClicked(params: {
  landing_type: "service" | "city" | "service_city";
  service_slug?: string;
  city_slug?: string;
  cta_type: "request_new" | "professionals_list" | "service_city_link";
  source_page?: string;
}): void {
  trackEvent("local_landing_cta_clicked", params);
}

type CampaignEventParams = {
  page_type: string;
  placement?: string;
  source_page?: string;
  user_type?: "client" | "pro" | "admin" | "unknown";
  service_slug?: string;
  city_slug?: string;
  profile_id?: string;
  cta_target?: string;
  cta_label?: string;
};

export function trackPrimaryCtaClicked(params: CampaignEventParams): void {
  trackEvent("primary_cta_clicked", params);
}

export function trackSecondaryCtaClicked(params: CampaignEventParams): void {
  trackEvent("secondary_cta_clicked", params);
}

export function trackHeroCtaClicked(params: CampaignEventParams): void {
  trackEvent("hero_cta_clicked", params);
}

export function trackTrustSectionViewed(params: {
  page_type: string;
  section_id?: string;
  source_page?: string;
  service_slug?: string;
  city_slug?: string;
}): void {
  trackEvent("trust_section_viewed", params);
}

export function trackFaqInteracted(params: {
  page_type: string;
  faq_id: string;
  faq_question?: string;
  source_page?: string;
  service_slug?: string;
  city_slug?: string;
}): void {
  trackEvent("faq_interacted", params);
}
