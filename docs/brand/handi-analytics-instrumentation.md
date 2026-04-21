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
- placement-level readiness
- campaign bundle manifests

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
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`

If either variable is missing, that provider stays disabled and the rest of the app continues working without breaking UI or Campaign OS flows.

## Current Limitations

- internal analytics and external analytics are still complementary, not unified in one reporting surface
- there is no server-side Measurement Protocol sync in this phase
- attribution is still basic and does not solve cross-channel deduplication
- not every page in the product is instrumented yet; this phase focuses on highest-value journeys and admin handoff actions
- paid media export remains handoff-oriented; Meta/Google live publish is still out of scope

## Natural Next Steps

- extend product-event coverage to additional high-intent journeys
- add server-side GA4 forwarding for webhook-confirmed milestones where browser-only delivery is not enough
- push campaign/placement identifiers into landing CTA destination builders more systematically
- expose a lightweight internal instrumentation catalog page if the team wants an in-product audit view
