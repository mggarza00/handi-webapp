import {
  EVENT_CATALOG,
  type EventCatalogItem,
} from "@/lib/analytics/event-catalog";

export type BuilderStatus = "central_builder" | "partial" | "manual";
export type CoverageStatus = "instrumented" | "partial" | "planned";

export type InstrumentationSurface = {
  id: string;
  label: string;
  route: string;
  surfaceType: "landing" | "journey" | "admin" | "api" | "shared";
  builderStatus: BuilderStatus;
  coverageStatus: CoverageStatus;
  events: string[];
  eventSource: "browser" | "server" | "hybrid";
  usesCampaignContext: boolean;
  notes: string;
};

export const INSTRUMENTATION_BUILDERS = [
  {
    name: "appendAnalyticsContextToUrl",
    file: "lib/analytics/url-context.ts",
    purpose:
      "Append Campaign OS identifiers and UTMs to internal or absolute URLs.",
  },
  {
    name: "buildTrackedAuthCtaHref",
    file: "lib/analytics/cta-builders.ts",
    purpose:
      "Build auth redirects with preserved next path and Campaign OS context.",
  },
  {
    name: "buildTrackedProApplyAuthHref",
    file: "lib/analytics/cta-builders.ts",
    purpose: "Convenience builder for pro apply acquisition/auth handoff.",
  },
  {
    name: "buildTrackedClientSignInHref",
    file: "lib/analytics/cta-builders.ts",
    purpose: "Convenience builder for client sign-in entry points.",
  },
  {
    name: "buildTrackedHrefFromCurrentAttribution",
    file: "lib/analytics/campaign-linking.ts",
    purpose:
      "Client-side helper that merges current attribution state into internal links.",
  },
  {
    name: "buildTrackedAuthHrefFromCookieHeader",
    file: "lib/analytics/cta-builders.ts",
    purpose:
      "Server-side helper for auth redirects that preserve stored attribution context.",
  },
  {
    name: "TrackedButtonLink",
    file: "components/analytics/TrackedButtonLink.client.tsx",
    purpose: "Tracked link wrapper that can also preserve attribution context.",
  },
];

export const INSTRUMENTATION_SURFACES: InstrumentationSurface[] = [
  {
    id: "analytics-provider",
    label: "AnalyticsProvider",
    route: "app/layout.tsx",
    surfaceType: "shared",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: ["landing_viewed"],
    eventSource: "browser",
    usesCampaignContext: true,
    notes:
      "Central browser-side bootstrapping for GA4, Clarity, page views, and attribution capture.",
  },
  {
    id: "landing-pro-apply-hero-cta",
    label: "Landing pro hero CTA",
    route: "components/landing/ProApplyLandingCta.client.tsx",
    surfaceType: "landing",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: ["primary_cta_clicked"],
    eventSource: "browser",
    usesCampaignContext: true,
    notes:
      "Uses current-attribution auth builder to preserve Campaign OS IDs through sign-in to pro apply.",
  },
  {
    id: "how-to-use-handi",
    label: "How To Use Handi CTA block",
    route: "app/_components/HowToUseHandiSection.client.tsx",
    surfaceType: "landing",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: ["request_started", "pro_apply_started"],
    eventSource: "browser",
    usesCampaignContext: true,
    notes:
      "Client and professional auth handoffs now use central builders instead of manual query strings.",
  },
  {
    id: "role-selection-dialog",
    label: "Role selection dialog",
    route: "components/RoleSelectionDialog.client.tsx",
    surfaceType: "landing",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: ["role_switched"],
    eventSource: "browser",
    usesCampaignContext: true,
    notes: "Auth routing keeps role intent and preserved campaign context.",
  },
  {
    id: "professional-seo-cta",
    label: "Professional landing CTA",
    route: "components/seo/ProfessionalLandingCta.client.tsx",
    surfaceType: "landing",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: ["primary_cta_clicked"],
    eventSource: "browser",
    usesCampaignContext: true,
    notes:
      "Uses tracked href builders for pro apply and jobs explore entry points.",
  },
  {
    id: "tracked-button-link",
    label: "TrackedButtonLink wrapper",
    route: "components/analytics/TrackedButtonLink.client.tsx",
    surfaceType: "shared",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: [
      "campaign_bundle_viewed",
      "export_package_downloaded",
      "download_bundle_downloaded",
    ],
    eventSource: "browser",
    usesCampaignContext: true,
    notes:
      "Now supports preserveAnalyticsContext and builder-supplied URL context without manual string assembly.",
  },
  {
    id: "pro-apply-auth-redirect",
    label: "Pro apply auth redirect",
    route: "app/(site)/(main-site)/pro-apply/page.tsx",
    surfaceType: "journey",
    builderStatus: "central_builder",
    coverageStatus: "instrumented",
    events: ["pro_apply_started"],
    eventSource: "hybrid",
    usesCampaignContext: true,
    notes:
      "Unauthenticated redirect now preserves stored attribution context server-side.",
  },
  {
    id: "services-auth-redirect",
    label: "Service detail auth redirect",
    route: "app/(site)/(main-site)/services/[id]/page.tsx",
    surfaceType: "journey",
    builderStatus: "central_builder",
    coverageStatus: "partial",
    events: ["fee_checkout_started"],
    eventSource: "hybrid",
    usesCampaignContext: true,
    notes:
      "Login redirect now preserves attribution context; downstream service confirmation remains partly manual.",
  },
  {
    id: "request-explore-auth-redirect",
    label: "Request explore auth redirect",
    route: "app/(site)/(main-site)/requests/explore/[id]/page.tsx",
    surfaceType: "journey",
    builderStatus: "central_builder",
    coverageStatus: "partial",
    events: ["contact_intent"],
    eventSource: "hybrid",
    usesCampaignContext: true,
    notes:
      "Login redirect now preserves attribution context for professional request-detail entry.",
  },
  {
    id: "requests-api-confirmed",
    label: "Request creation API",
    route: "app/api/requests/route.ts",
    surfaceType: "api",
    builderStatus: "partial",
    coverageStatus: "instrumented",
    events: ["request_created_confirmed"],
    eventSource: "server",
    usesCampaignContext: true,
    notes:
      "Confirmed request creation now reaches GA4 via Measurement Protocol.",
  },
  {
    id: "pro-applications-api-confirmed",
    label: "Pro applications API",
    route: "app/api/pro-applications/route.ts",
    surfaceType: "api",
    builderStatus: "partial",
    coverageStatus: "instrumented",
    events: ["pro_apply_completed_confirmed"],
    eventSource: "server",
    usesCampaignContext: true,
    notes:
      "Confirmed application creation now reaches GA4 via Measurement Protocol.",
  },
  {
    id: "stripe-webhook-confirmed",
    label: "Stripe webhook payment confirmation",
    route: "app/api/stripe/webhook/route.ts",
    surfaceType: "api",
    builderStatus: "partial",
    coverageStatus: "instrumented",
    events: ["fee_paid_confirmed"],
    eventSource: "server",
    usesCampaignContext: true,
    notes:
      "Reliable monetization closure comes from confirmed webhook processing, not browser-only callbacks.",
  },
  {
    id: "campaign-export-downloads",
    label: "Campaign export and bundle downloads",
    route: "app/api/admin/campaigns/[id]/*",
    surfaceType: "admin",
    builderStatus: "partial",
    coverageStatus: "instrumented",
    events: [
      "campaign_bundle_viewed",
      "export_package_downloaded",
      "export_package_downloaded_confirmed",
      "download_bundle_downloaded",
      "download_bundle_downloaded_confirmed",
    ],
    eventSource: "hybrid",
    usesCampaignContext: true,
    notes:
      "Admin handoff actions now have both click-level and confirmed server-side analytics.",
  },
  {
    id: "landing-client-request-wizard",
    label: "Client request landing CTA",
    route: "components/landing/ClientRequestLandingCta.client.tsx",
    surfaceType: "landing",
    builderStatus: "partial",
    coverageStatus: "instrumented",
    events: ["primary_cta_clicked", "request_started"],
    eventSource: "browser",
    usesCampaignContext: true,
    notes:
      "Opens local request wizard, so it does not need a URL builder but still depends on current attribution state.",
  },
];

export function getInstrumentationAudit() {
  const totalEvents = EVENT_CATALOG.length;
  const instrumentedEvents = EVENT_CATALOG.filter(
    (event) => event.status === "instrumented",
  ).length;
  const serverEvents = EVENT_CATALOG.filter(
    (event) => event.source === "server",
  ).length;
  const browserEvents = EVENT_CATALOG.filter(
    (event) => event.source === "browser",
  ).length;
  const hybridEvents = EVENT_CATALOG.filter(
    (event) => event.source === "hybrid",
  ).length;
  const builderBackedSurfaces = INSTRUMENTATION_SURFACES.filter(
    (surface) => surface.builderStatus === "central_builder",
  ).length;
  const manualOrPartialSurfaces = INSTRUMENTATION_SURFACES.filter(
    (surface) => surface.builderStatus !== "central_builder",
  ).length;

  return {
    summary: {
      totalEvents,
      instrumentedEvents,
      plannedEvents: totalEvents - instrumentedEvents,
      browserEvents,
      serverEvents,
      hybridEvents,
      totalSurfaces: INSTRUMENTATION_SURFACES.length,
      builderBackedSurfaces,
      manualOrPartialSurfaces,
    },
    events: EVENT_CATALOG,
    surfaces: INSTRUMENTATION_SURFACES,
    builders: INSTRUMENTATION_BUILDERS,
    criticalJourneys: Array.from(
      new Set(EVENT_CATALOG.map((event) => event.journey)),
    ),
  };
}

export function getInstrumentationGaps(events: EventCatalogItem[]) {
  return events.filter((event) => event.status !== "instrumented");
}
