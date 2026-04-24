# Handi Instrumentation Audit

## Purpose

This audit layer gives product, growth, and engineering a compact answer to five practical questions:

1. Which canonical events exist today?
2. Which ones are browser-only vs server-confirmed?
3. Which owned surfaces already use central Campaign OS-aware builders?
4. Which surfaces still depend on partial/manual propagation?
5. Which gaps remain before instrumentation coverage feels operationally reliable?

## Code Sources

- `lib/analytics/event-catalog.ts`
- `lib/analytics/instrumentation-audit.ts`
- `lib/analytics/runtime-health.ts`
- `app/admin/system/instrumentation/page.tsx`

## What The Audit Shows

The internal audit surface at `/admin/system/instrumentation` exposes:

- canonical event catalog
- event source split: browser, server, hybrid
- journey classification
- whether the event is already instrumented or still planned
- whether Campaign OS context is expected in the payload
- builder-backed surfaces vs partial/manual surfaces
- runtime health based on latest observed dispatches
- last seen / last success by canonical event
- journey-level and surface-level health derived from recent observation

## Builders In Scope

Primary builders:

- `appendAnalyticsContextToUrl`
- `buildTrackedAuthHref`
- `buildTrackedInternalHref`
- `buildTrackedAuthCtaHref`
- `buildTrackedProApplyAuthHref`
- `buildTrackedClientSignInHref`
- `buildTrackedHrefFromCurrentAttribution`
- `buildTrackedAuthHrefFromCurrentAttribution`
- `buildTrackedAuthHrefFromCookieHeader`

## Surfaces Already Migrated

- pro apply landing CTA
- How To Use Handi CTA block
- role selection dialog
- professional landing CTA
- tracked auth redirects for:
  - `/pro-apply`
  - `/services/[id]`
  - `/requests/explore/[id]`
- `TrackedButtonLink` now supports preserved attribution context

## Known Gaps

- not every owned CTA surface uses the new builders yet
- some flows still rely on local wizard state rather than tracked URLs
- backend-confirmed payment attribution is still limited by what survives third-party redirects
- runtime health reflects Handi's own dispatch observation, not downstream provider reporting truth
- Clarity/GA4 can still be enabled or skipped per environment, so `partial` can be expected locally

## Runtime Health Layer

Runtime health is intentionally lightweight and does not try to replace GA4 or Clarity.

It stores the latest observed state per:

- `event_name`
- `event_source`
- `provider_target`

The current persistence model is a rollup table:

- `public.instrumentation_runtime_observations`

For each canonical event/provider combination Handi keeps:

- `last_observed_at`
- `last_success_at`
- `last_failure_at`
- `last_dispatch_status`
- `last_route_path`
- `last_surface_id`

This means the system is optimized for operational coverage checks, not for raw event replay history.

## Runtime Health States

- `healthy`: a successful observation exists within the healthy window and expected providers are present
- `partial`: the event was seen recently, but only with skipped/failed dispatches or incomplete provider coverage
- `stale`: the event had a successful observation before, but not within the healthy window
- `missing`: no recent successful observation exists within the stale window
- `unknown`: the event is not yet instrumented or runtime health data is unavailable

Current windows:

- healthy: `72h`
- stale: `14d`

## What Runtime Health Measures

- whether Handi dispatched a canonical event recently
- whether the dispatch was marked `success`, `skipped`, or `failed`
- whether browser/server critical events are still alive in the product
- whether static builder migration and runtime observation line up reasonably well

## What Runtime Health Does Not Measure

- whether GA4 ingested the event successfully after Handi dispatched it
- whether Clarity replay/heatmap data appeared downstream
- full provider reliability or data completeness
- user-level attribution quality
- product/business correctness of the payload itself

## Operational Use

Use this audit before expanding instrumentation to a new flow:

1. Add or update the canonical event in `event-catalog.ts`
2. Register the surface in `instrumentation-audit.ts`
3. Prefer central builders over manual query strings
4. Keep browser vs server responsibility explicit
5. Check `/admin/system/instrumentation` after shipping to confirm runtime signal appears
6. Update docs when a gap is closed
