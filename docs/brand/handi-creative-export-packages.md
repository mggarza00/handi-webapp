# Handi Creative Export Packages

## Goal

Creative export packages are the structured JSON handoff artifact for campaign copy + approved visuals.

They are designed for:

- internal review
- operational handoff
- paid media prep
- future analytics instrumentation alignment

They do not auto-publish visuals externally.

## Package Scopes

### Campaign package

Aggregates every publishable channel plus placement coverage where applicable.

### Channel package

Focused export for one channel, including placement coverage for that channel.

### Placement package

Focused export for one paid/export placement such as:

- `meta_feed_square`
- `meta_feed_portrait`
- `meta_story_vertical`
- `google_display_landscape`
- `google_display_square`
- `landing_hero`
- `landing_secondary_banner`

## What A Package Contains

Each package includes:

- campaign metadata
- selected copy
- selected creative bundle metadata
- provider metadata
- readiness state
- warnings and missing items
- suggested filenames
- tracking contract for future analytics instrumentation

## Campaign Package Structure

- `campaignId`
- `campaignTitle`
- `summary`
- `visualReadiness`
- `placementCoverage`
- `channels[]`

Each channel object contains:

- `channel`
- `connector`
- `campaign`
- `copy`
- `visualReadiness`
- `placementCoverage`
- `creativeBundle`
- `provider`
- `tracking`
- `placements[]`
- `notes`

## Placement Package Structure

Each placement package includes:

- `channel`
- `placementId`
- `placementLabel`
- `handoffName`
- `campaign`
- `copy`
- `placementReadiness`
- `creativeBundle`
- `provider`
- `tracking`
- `notes`

Copy is currently inherited from the selected channel-level message until Handi supports per-placement copy divergence.

## Readiness Model

### Channel visual readiness

- `ready_exact`
- `ready_fallback`
- `partial`
- `missing`
- `manual_override`
- `blocked`

### Placement readiness

- `ready_exact`
- `ready_fallback`
- `partial`
- `missing`
- `manual_override`
- `blocked`

Placement readiness is now the finer paid handoff truth where needed.

## Placement Rules Included In Packages

The package surface now exposes:

- required format
- preferred dimensions
- exact vs fallback coverage
- missing or blocked states
- selected asset per placement
- warnings specific to that placement

This keeps paid handoff honest even when a channel appears generally covered.

## Tracking Contracts

Every channel package and placement package now includes a tracking contract meant to stay compatible with future:

- Google Analytics 4
- Microsoft Clarity

The contract currently includes:

- core campaign identifiers
- channel
- placement id when applicable
- message id
- variant name
- creative asset id
- derivative asset id
- bundle status
- readiness status
- provider metadata references
- base UTM mapping
- suggested GA4 events
- suggested Clarity tags

## UTM Mapping Convention

The current base contract prepares:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

with channel- and placement-aware naming so future paid setup and site instrumentation can stay consistent.

## Admin Access

From `/admin/campaigns/[id]`, the team can now:

- open full campaign package JSON
- download full campaign package JSON
- open channel package JSON
- download channel package JSON
- open placement package JSON
- download placement package JSON

## Activity Feed

Package generation can now emit:

- `creative_export_package_generated`
- `creative_export_package_downloaded`
- `placement_export_generated`
- `analytics_contracts_updated`
- `attribution_mapping_prepared`

## Current Limitations

- copy is still channel-level rather than placement-specific
- packages are prepared for handoff, not live Meta/Google publishing
- GA4 and Clarity are not fully wired live yet in this phase
- placement rules are conservative and finite, not exhaustive across every paid-media subtype

## Natural Next Steps

- wire real GA4/Clarity instrumentation on the destination surfaces
- allow placement-specific copy if paid operations require it
- expand placement presets beyond the initial paid/export targets
- connect future external draft creation to the same placement-aware manifest
