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
- `lib/analytics/measurement-protocol.ts`
- `lib/analytics/server-events.ts`
- `lib/analytics/runtime-health.ts`
- `lib/analytics/url-context.ts`
- `lib/analytics/cta-builders.ts`
- `lib/analytics/event-catalog.ts`

The provider is mounted once in `app/layout.tsx`.

## Required Environment Variables

- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
- `GA4_API_SECRET`
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
- `request_created_confirmed`
- `pro_apply_completed_confirmed`
- `fee_paid_confirmed`
- `export_package_downloaded_confirmed`
- `download_bundle_downloaded_confirmed`

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

`campaign_context` is also persisted in cookies now, so backend-confirmed events can recover Campaign OS identifiers after redirects or intermediate navigation.

## Browser vs Server Split

Current operating policy:

- `browser` remains responsible for views, clicks, CTA interactions, and funnel starts
- `server` is used only for confirmed milestones that were persisted or validated by backend logic
- confirmed milestones use explicit names such as `fee_paid_confirmed` instead of replaying the browser event name

This keeps GA4 usable without pretending there is perfect deduplication.

## Current Server-Confirmed Events

- `request_created_confirmed`
- `pro_apply_completed_confirmed`
- `fee_paid_confirmed`
- `export_package_downloaded_confirmed`
- `download_bundle_downloaded_confirmed`

These events are emitted through GA4 Measurement Protocol with:

- `event_source=server`
- `event_id`
- `correlation_id` when the backend has a stable identifier

## Builder-Aware Propagation

GA4 and Clarity stay more coherent now because owned CTA and redirect builders preserve the same Campaign OS identifiers instead of rebuilding query strings by hand.

Priority migrated surfaces include:

- pro apply hero CTA
- role selection dialog
- How To Use Handi CTA block
- professional landing CTA
- tracked auth redirects for pro apply, services detail, and request explore detail

The new audit surface at `/admin/system/instrumentation` exposes which of these are already using central builders and which surfaces remain partial/manual.

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
- full attribution stitching from Stripe or other third-party webhooks back to original browser sessions
- cross-device or cross-channel attribution stitching
- direct Meta/Google live publish instrumentation
- video creative analytics

## Runtime Observation Note

GA4 and Clarity now coexist with a small internal runtime-health layer.

That layer:

- records that Handi attempted a browser/server dispatch
- stores the latest `success`, `skipped`, or `failed` state per canonical event/provider
- powers `/admin/system/instrumentation`

That layer does **not** mean:

- GA4 definitely ingested the hit
- Clarity definitely produced replay/heatmap data
- downstream analytics data is complete

## Operational Note

When debugging campaign-linked journeys, start from the internal Campaign OS identifiers and verify that the same values appear in:

- bundle manifests
- export/download payloads
- GA4 custom params
- Clarity custom tags

That keeps editorial, creative, and analytics views aligned even before advanced attribution exists.
