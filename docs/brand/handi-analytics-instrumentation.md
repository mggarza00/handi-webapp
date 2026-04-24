# Handi Analytics Instrumentation

## Purpose

Handi now uses three complementary analytics layers:

- `Campaign OS` remains the internal source of truth for editorial decisions, publish workflow, bundles, readiness, QA, and operational analytics.
- `GA4` captures quantitative web traffic, funnels, campaign-linked events, and conversion signals on owned surfaces.
- `Microsoft Clarity` captures qualitative behavior for debugging friction with heatmaps and session replay.

This phase keeps the naming and identifiers shared across all three layers so campaign handoff, attribution, and product journeys stay traceable.

## Current Implementation

Central files:

- `components/analytics/AnalyticsProvider.tsx`
- `components/analytics/EventTracker.client.tsx`
- `components/analytics/TrackedButtonLink.client.tsx`
- `lib/analytics/ga4.ts`
- `lib/analytics/clarity.ts`
- `lib/analytics/tracking.ts`
- `lib/analytics/track.ts`
- `lib/analytics/attribution.ts`
- `lib/analytics/measurement-protocol.ts`
- `lib/analytics/server-events.ts`
- `lib/analytics/url-context.ts`
- `lib/analytics/campaign-linking.ts`
- `lib/analytics/cta-builders.ts`
- `lib/analytics/event-catalog.ts`
- `lib/analytics/instrumentation-audit.ts`
- `lib/analytics/runtime-health.ts`
- `lib/analytics/runtime-health.client.ts`
- `lib/analytics/schemas.ts`
- `lib/analytics/tracking-contracts.ts`
- `lib/analytics/campaign-attribution.ts`

`AnalyticsProvider` is mounted in `app/layout.tsx` and is the single web-entry point for:

- GA4 script bootstrapping
- Clarity script bootstrapping
- page view dispatch
- attribution capture from URL parameters
- lightweight landing-view dispatch for owned marketing surfaces

## Event Strategy

Canonical event names currently wired for owned surfaces:

- `landing_viewed`
- `cta_clicked`
- `primary_cta_clicked`
- `secondary_cta_clicked`
- `sign_up_started`
- `sign_up_completed`
- `login_completed`
- `request_started`
- `request_created`
- `pro_apply_started`
- `pro_apply_completed`
- `fee_checkout_started`
- `fee_paid`
- `campaign_bundle_viewed`
- `creative_bundle_viewed`
- `export_package_downloaded`
- `download_bundle_downloaded`
- `request_created_confirmed`
- `pro_apply_completed_confirmed`
- `fee_paid_confirmed`
- `export_package_downloaded_confirmed`
- `download_bundle_downloaded_confirmed`

The existing wrapper layer in `lib/analytics/track.ts` now routes into the central dispatcher in `lib/analytics/tracking.ts`, so existing product code keeps working without duplicating provider logic.

## Owned Journeys Covered

Current priority instrumentation:

- Client acquisition and conversion
- Professional acquisition and application
- Payment confirmation flows tied to service fees / onsite quote payments
- Campaign OS export and download handoff actions from admin

Concrete product surfaces already wired:

- marketing/landing routes through `AnalyticsProvider`
- local landing trackers through `components/analytics/LocalLandingTracker.client.tsx`
- sign-up/login wrappers through `components/auth/useEmailPasswordAuth.ts` and related auth flows
- request creation flow through `components/requests/useCreateRequestForm.ts`
- professional apply flow through `app/(site)/(main-site)/pro-apply/pro-apply-form.client.tsx`
- payment dialogs through `components/payments/OfferPaymentDialog.tsx` and `components/payments/OnsitePaymentDialog.tsx`
- campaign export/download actions through `app/admin/campaigns/[id]/page.tsx`

## Browser vs Server Event Policy

Handi now uses a conservative hybrid policy instead of trying to mirror every event twice.

Browser-side events remain the source for:

- page views
- CTA clicks
- landing views
- funnel starts and intermediate actions

Server-side GA4 Measurement Protocol events are used only for confirmed milestones where backend persistence or webhook confirmation exists:

- `request_created_confirmed` from `app/api/requests/route.ts`
- `pro_apply_completed_confirmed` from `app/api/pro-applications/route.ts`
- `fee_paid_confirmed` from `app/api/stripe/webhook/route.ts`
- `export_package_downloaded_confirmed` from `app/api/admin/campaigns/[id]/export-package/route.ts`
- `download_bundle_downloaded_confirmed` from `app/api/admin/campaigns/[id]/download-bundle/route.ts`

This avoids obvious double counting by using distinct confirmed event names instead of firing the same canonical browser event again from the server.

## Event Source and Dedupe

Every dispatched analytics payload now carries:

- `event_source`
- `event_id`
- `correlation_id` when the backend already has a stable reference

Current policy:

- browser events are tagged with `event_source=browser`
- backend-confirmed events are tagged with `event_source=server`
- confirmed events use a distinct `*_confirmed` name family
- no advanced cross-device dedupe is attempted in this phase

## Shared Campaign OS Context

Tracked payloads can now carry both external acquisition context and internal Campaign OS identifiers.

UTM and click-id context preserved from the URL:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `utm_id`
- `gclid`
- `fbclid`
- `msclkid`
- `ttclid`

Internal Campaign OS context that can also be captured from URLs or passed directly:

- `campaign_id`
- `channel`
- `placement_id`
- `message_id`
- `placement_copy_id`
- `placement_copy_source`
- `variant_id`
- `variant_name`
- `creative_asset_id`
- `derivative_asset_id`
- `bundle_status`
- `readiness_status`
- `provider_name`
- `provider_mode`

This lets GA4 and Clarity use the same language already present in:

- creative export packages
- download bundles
- placement-level copy resolution
- placement-level readiness
- campaign bundle manifests

## Attribution Propagation

Campaign OS context now travels through two aligned mechanisms:

- URL/query propagation through `lib/analytics/url-context.ts` and `lib/analytics/campaign-linking.ts`
- cookie persistence from `lib/analytics/attribution.ts`

The attribution layer now persists:

- first touch
- last touch
- `campaign_context`

That means backend-confirmed routes can read Campaign OS identifiers even when the final conversion happens after internal navigation or auth redirects.

## Builders Available

Current reusable builders:

- `appendAnalyticsContextToUrl`
- `buildTrackedAuthHref`
- `buildTrackedInternalHref`
- `buildTrackedAuthCtaHref`
- `buildTrackedProApplyAuthHref`
- `buildTrackedClientSignInHref`
- `buildTrackedHrefFromCurrentAttribution`
- `buildTrackedAuthHrefFromCurrentAttribution`
- `buildTrackedAuthHrefFromCookieHeader`

Use these instead of assembling query strings manually.

## Surfaces Migrated To Central Builders

High-value surfaces already migrated:

- `components/landing/ProApplyLandingCta.client.tsx`
- `app/_components/HowToUseHandiSection.client.tsx`
- `components/RoleSelectionDialog.client.tsx`
- `components/seo/ProfessionalLandingCta.client.tsx`
- `components/analytics/TrackedButtonLink.client.tsx`
- `app/(site)/(main-site)/pro-apply/page.tsx`
- `app/(site)/(main-site)/services/[id]/page.tsx`
- `app/(site)/(main-site)/requests/explore/[id]/page.tsx`

These now preserve Campaign OS identifiers and UTM context more systematically through owned auth and journey handoffs.

## Instrumentation Audit

There is now a lightweight internal audit surface at:

- `/admin/system/instrumentation`

It shows:

- canonical event catalog
- browser vs server source split
- surfaces already using central builders
- partial/manual gaps that still need cleanup
- runtime health derived from recent dispatch observation
- last seen / last success by canonical event
- journey and surface-level coverage summaries

## Runtime Health Policy

Runtime health is not a second analytics platform. It is an internal operations layer that answers a narrower question:

- is Handi still dispatching the canonical instrumentation it expects to dispatch?

Current implementation:

- browser dispatchers report best-effort observations through `/api/internal/analytics/runtime-observation`
- server-confirmed dispatchers report observations directly from `lib/analytics/server-events.ts`
- the data is rolled up in `instrumentation_runtime_observations`

Current states:

- `healthy`
- `partial`
- `stale`
- `missing`
- `unknown`

Current windows:

- healthy window: `72h`
- stale window: `14d`

Interpretation:

- `healthy` means at least one expected provider saw a successful dispatch within the healthy window
- `partial` means the event was seen recently but only with skipped/failed dispatches or incomplete provider coverage
- `stale` means the event succeeded before, but not recently enough
- `missing` means no recent successful observation exists
- `unknown` means the event is planned/not instrumented or runtime health data is unavailable

## GA4 Mapping

GA4 is the primary quantitative layer for:

- page views
- key conversion/funnel events
- campaign-linked CTA interactions
- export/download actions tied to Campaign OS

The central dispatcher sends sanitized event payloads to GA4 via `gtag`.

Recommended custom params already aligned with Campaign OS:

- `campaign_id`
- `channel`
- `placement_id`
- `message_id`
- `variant_id`
- `variant_name`
- `creative_asset_id`
- `derivative_asset_id`
- `bundle_status`
- `readiness_status`
- UTM fields when available

## Clarity Mapping

Clarity is used for:

- heatmaps
- session replay
- friction analysis on owned conversion journeys

The dispatcher sends:

- event markers through `clarity("event", name)`
- session/page tags through `clarity("set", key, value)`

Current tag family includes:

- `handi_campaign_id`
- `handi_channel`
- `handi_placement_id`
- `handi_message_id`
- `handi_creative_asset_id`
- `handi_derivative_asset_id`
- `handi_bundle_status`
- `handi_readiness_status`
- `handi_utm_campaign`
- `handi_utm_source`
- `handi_utm_medium`
- `handi_page_path`

## Environment Variables

Required to activate live web analytics:

- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `GA4_API_SECRET`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`

If either variable is missing, that provider stays disabled and the rest of the app continues working without breaking UI or Campaign OS flows.

## Current Limitations

- internal analytics and external analytics are still complementary, not unified in one reporting surface
- server-side confirmed GA4 is still intentionally narrow and only covers strong backend milestones
- attribution is still basic and does not solve cross-channel deduplication
- Stripe webhook confirmations do not automatically recover full browser acquisition context unless it was already preserved before checkout
- not every page in the product is instrumented yet; this phase focuses on highest-value journeys and admin handoff actions
- paid media export remains handoff-oriented; Meta/Google live publish is still out of scope
- runtime health is based on Handi's own dispatch observation, not on downstream GA4/Clarity ingestion confirmation

## Natural Next Steps

- extend product-event coverage to additional high-intent journeys
- push tracked URL builders into more owned CTA surfaces beyond the current high-value landings
- backfill stable campaign context into more backend-confirmed flows where a server webhook currently lacks browser attribution
- expose a lightweight internal instrumentation catalog page if the team wants an in-product audit view
