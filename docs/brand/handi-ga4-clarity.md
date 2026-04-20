# Handi GA4 + Clarity

## Role Split

Handi uses GA4 and Microsoft Clarity with a strict separation of concerns:

- `GA4`: quantitative analytics for traffic, funnels, conversions, CTA performance, and campaign-linked product events.
- `Clarity`: qualitative analytics for heatmaps, session replay, and friction analysis on owned surfaces.
- `Campaign OS`: internal operational truth for campaign generation, review, creative bundles, readiness, exports, and publish workflow.

Neither GA4 nor Clarity replaces the internal analytics layer.

## Bootstrapping

Client initialization lives in:

- `components/analytics/AnalyticsProvider.tsx`

Provider-specific helpers:

- `lib/analytics/ga4.ts`
- `lib/analytics/clarity.ts`
- `lib/analytics/tracking.ts`

The provider is mounted once in `app/layout.tsx`.

## Required Environment Variables

- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`

If an env is missing:

- that provider is disabled
- tracking helpers stay safe
- product UX and Campaign OS workflows continue to function

## Supported Events

Current business-priority events:

- `landing_viewed`
- `primary_cta_clicked`
- `secondary_cta_clicked`
- `sign_up_started`
- `sign_up_completed`
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

Some legacy wrapper names still exist in app code, but they now normalize into the canonical event family above.

## Campaign OS Fields Included

When available, tracked events can include:

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

These match the shared contracts already used by:

- creative export packages
- paid handoff manifests
- placement-aware download bundles

## UTM Preservation

The attribution layer preserves:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `utm_id`

and click identifiers when present:

- `gclid`
- `fbclid`
- `msclkid`
- `ttclid`

This context is merged automatically into event payloads sent through the central dispatcher.

## Clarity Session Tagging

Clarity is tagged with a conservative session/page metadata set so teams can segment replay and heatmaps by:

- campaign
- channel
- placement
- creative
- readiness/bundle state
- UTM campaign/source/medium

This is intentionally lightweight and human-readable.

## What Is Instrumented Now

Highest-value owned surfaces covered in this phase:

- homepage and core marketing landing routes
- local landing trackers
- sign-up / login entry points
- request creation
- pro apply
- fee/payment confirmation flows
- Campaign OS export/download actions in admin

## What Is Not Covered Yet

- full product-wide event coverage
- server-side GA4 events for every backend milestone
- cross-device or cross-channel attribution stitching
- direct Meta/Google live publish instrumentation
- video creative analytics

## Operational Note

When debugging campaign-linked journeys, start from the internal Campaign OS identifiers and verify that the same values appear in:

- bundle manifests
- export/download payloads
- GA4 custom params
- Clarity custom tags

That keeps editorial, creative, and analytics views aligned even before advanced attribution exists.
