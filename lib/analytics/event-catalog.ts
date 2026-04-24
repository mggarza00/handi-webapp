import type {
  AnalyticsEventName,
  AnalyticsEventSource,
} from "@/lib/analytics/schemas";

export type InstrumentationJourney =
  | "landing"
  | "client_request"
  | "pro_apply"
  | "checkout"
  | "campaign_ops"
  | "account";

export type InstrumentationStatus = "instrumented" | "planned";

export type EventCatalogItem = {
  name: AnalyticsEventName;
  source: AnalyticsEventSource | "hybrid";
  journey: InstrumentationJourney;
  businessGoal: string;
  keyFields: string[];
  status: InstrumentationStatus;
  usesCampaignContext: boolean;
  providers: Array<"ga4" | "clarity" | "campaign_os">;
  notes: string;
};

export const EVENT_CATALOG: EventCatalogItem[] = [
  {
    name: "landing_viewed",
    source: "browser",
    journey: "landing",
    businessGoal: "Measure owned-surface traffic and campaign landing reach.",
    keyFields: ["page_path", "campaign_id", "channel", "placement_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity", "campaign_os"],
    notes: "Dispatched from AnalyticsProvider and local landing trackers.",
  },
  {
    name: "cta_clicked",
    source: "browser",
    journey: "landing",
    businessGoal:
      "Track CTA interaction across hero and mixed marketing surfaces.",
    keyFields: ["cta_label", "cta_target", "placement", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Used for generic click instrumentation where a more specific CTA event is not needed.",
  },
  {
    name: "primary_cta_clicked",
    source: "browser",
    journey: "landing",
    businessGoal: "Measure primary conversion intent from owned surfaces.",
    keyFields: ["cta_label", "cta_target", "placement", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Priority CTA event for campaign-linked handoff and acquisition flows.",
  },
  {
    name: "secondary_cta_clicked",
    source: "browser",
    journey: "landing",
    businessGoal:
      "Measure secondary CTA interaction without mixing with primary intent.",
    keyFields: ["cta_label", "cta_target", "placement", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Used where secondary CTAs still matter for funnel diagnostics.",
  },
  {
    name: "sign_up_started",
    source: "browser",
    journey: "account",
    businessGoal: "Measure auth funnel starts from owned surfaces.",
    keyFields: ["method", "source_page", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Auth wrappers capture this before sign-up submission.",
  },
  {
    name: "sign_up_completed",
    source: "browser",
    journey: "account",
    businessGoal: "Measure successful account creation on owned surfaces.",
    keyFields: ["method", "user_type", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Complements server-confirmed milestone strategy without duplicating backend persistence.",
  },
  {
    name: "login_completed",
    source: "browser",
    journey: "account",
    businessGoal: "Measure successful auth return from campaign-linked flows.",
    keyFields: ["method", "user_type", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Useful when campaign-linked journeys require auth before continuing.",
  },
  {
    name: "request_started",
    source: "browser",
    journey: "client_request",
    businessGoal: "Measure client request funnel starts.",
    keyFields: ["source_page", "user_type", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Fired when request wizard or request creation flow begins.",
  },
  {
    name: "request_created",
    source: "browser",
    journey: "client_request",
    businessGoal: "Measure request submission attempts from the browser layer.",
    keyFields: ["request_id", "service_category", "city", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Kept for browser continuity; server-confirmed version exists for reliable backend closure.",
  },
  {
    name: "request_created_confirmed",
    source: "server",
    journey: "client_request",
    businessGoal: "Record a backend-confirmed request creation milestone.",
    keyFields: ["request_id", "service_category", "city", "event_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes: "Emitted from /api/requests after persistence succeeds.",
  },
  {
    name: "pro_apply_started",
    source: "browser",
    journey: "pro_apply",
    businessGoal: "Measure professional application funnel starts.",
    keyFields: ["source_page", "campaign_id", "channel"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Used on owned pro-acquisition surfaces before auth/application.",
  },
  {
    name: "pro_apply_completed",
    source: "browser",
    journey: "pro_apply",
    businessGoal:
      "Measure professional application completion from the browser layer.",
    keyFields: ["service_category", "city", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Browser layer remains useful for UX diagnostics even after confirmed backend events were added.",
  },
  {
    name: "pro_apply_completed_confirmed",
    source: "server",
    journey: "pro_apply",
    businessGoal:
      "Record a backend-confirmed professional application milestone.",
    keyFields: ["user_type", "service_category", "city", "event_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes: "Emitted from /api/pro-applications after persistence succeeds.",
  },
  {
    name: "fee_checkout_started",
    source: "browser",
    journey: "checkout",
    businessGoal:
      "Measure payment funnel starts before Stripe or fee confirmation.",
    keyFields: ["request_id", "offer_id", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Used as intent/start, not as source of truth for payment completion.",
  },
  {
    name: "fee_paid",
    source: "browser",
    journey: "checkout",
    businessGoal:
      "Measure client-side payment success signals when the browser completes the flow.",
    keyFields: ["request_id", "offer_id", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes:
      "Retained for funnel visibility; server-confirmed payment is the reliable closure event.",
  },
  {
    name: "fee_paid_confirmed",
    source: "server",
    journey: "checkout",
    businessGoal:
      "Record confirmed monetization from Stripe webhook processing.",
    keyFields: ["payment_intent_id", "request_id", "offer_id", "event_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes:
      "Emitted from Stripe webhook after payment confirmation and internal finalization work.",
  },
  {
    name: "professional_profile_viewed",
    source: "browser",
    journey: "landing",
    businessGoal:
      "Track profile detail consideration before contact or application.",
    keyFields: ["profile_id", "source_page", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Useful for marketplace evaluation journeys.",
  },
  {
    name: "contact_intent",
    source: "browser",
    journey: "client_request",
    businessGoal: "Measure intent to contact or initiate conversation.",
    keyFields: ["request_id", "profile_id", "conversation_id", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Still browser-only in this phase.",
  },
  {
    name: "role_switched",
    source: "browser",
    journey: "account",
    businessGoal:
      "Understand switching between client/pro roles and entry expectations.",
    keyFields: ["origin_role", "destination_role", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4"],
    notes: "Useful for mixed landing flows and auth routing.",
  },
  {
    name: "trust_section_viewed",
    source: "browser",
    journey: "landing",
    businessGoal: "Measure exposure to trust-building sections.",
    keyFields: ["section_id", "source_page", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Supports messaging and landing optimization.",
  },
  {
    name: "faq_interacted",
    source: "browser",
    journey: "landing",
    businessGoal: "Measure FAQ engagement and objection handling.",
    keyFields: ["faq_id", "faq_question", "campaign_id"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "clarity"],
    notes: "Supports content and objection analysis.",
  },
  {
    name: "campaign_bundle_viewed",
    source: "browser",
    journey: "campaign_ops",
    businessGoal: "Track inspection of campaign packages and handoff payloads.",
    keyFields: ["campaign_id", "channel", "bundle_status", "readiness_status"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes: "Used from admin handoff surfaces.",
  },
  {
    name: "creative_bundle_viewed",
    source: "browser",
    journey: "campaign_ops",
    businessGoal: "Track inspection of creative bundles tied to campaigns.",
    keyFields: ["campaign_id", "creative_asset_id", "bundle_status"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes: "Supports internal operational analytics for creative review.",
  },
  {
    name: "export_package_downloaded",
    source: "browser",
    journey: "campaign_ops",
    businessGoal: "Track download intent for export packages from admin UI.",
    keyFields: ["campaign_id", "channel", "bundle_status"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes:
      "Client-side click event complements the confirmed server download event.",
  },
  {
    name: "export_package_downloaded_confirmed",
    source: "server",
    journey: "campaign_ops",
    businessGoal:
      "Track confirmed package generation/download at the route level.",
    keyFields: ["campaign_id", "event_id", "readiness_status"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes: "Emitted only when the export route actually serves the package.",
  },
  {
    name: "download_bundle_downloaded",
    source: "browser",
    journey: "campaign_ops",
    businessGoal: "Track bundle ZIP download intent from admin UI.",
    keyFields: ["campaign_id", "channel", "bundle_status"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes:
      "Client-side click event complements the confirmed server bundle download event.",
  },
  {
    name: "download_bundle_downloaded_confirmed",
    source: "server",
    journey: "campaign_ops",
    businessGoal:
      "Track confirmed ZIP bundle generation/download at the route level.",
    keyFields: ["campaign_id", "event_id", "readiness_status"],
    status: "instrumented",
    usesCampaignContext: true,
    providers: ["ga4", "campaign_os"],
    notes:
      "Emitted only when the ZIP bundle is built and returned by the server.",
  },
];

export const EVENT_CATALOG_BY_NAME = Object.fromEntries(
  EVENT_CATALOG.map((event) => [event.name, event]),
) as Record<AnalyticsEventName, EventCatalogItem>;

export function getEventCatalogItem(name: AnalyticsEventName) {
  return EVENT_CATALOG_BY_NAME[name];
}
