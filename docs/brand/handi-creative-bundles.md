# Handi Creative Bundles

## Goal

Creative bundles resolve which approved visual asset Handi should use when preparing copy + creative handoff for a campaign channel.

This layer stays inside Handi and keeps visual selection aligned with:

- campaign approval
- creative review
- bundle overrides
- visual readiness
- export and download handoff

## Channel vs Placement

There are now two related levels:

- channel bundle
  One resolved visual selection per publishable channel.
- placement coverage
  A finer readiness layer for paid/export contexts where one channel maps to multiple placement targets.

Channel bundles remain the primary editorial selection surface.
Placement coverage refines whether that channel is actually ready for handoff.

## Current Channel Bundle Model

`campaign_creative_bundles` stores one row per campaign and channel.

Main fields:

- `campaign_draft_id`
- `channel`
- `selected_master_asset_id`
- `selected_derivative_asset_id`
- `required_format`
- `suitability_status`
- `selection_source`
- `notes`
- `created_at`
- `updated_at`

## Bundle Suitability Status

- `ready`
  The channel has an approved asset that matches the expected channel format closely enough.
- `partial`
  The channel has a usable approved fallback, but not the preferred exact derivative.
- `missing`
  No approved visual is currently suitable for that channel.
- `manual_override`
  An admin explicitly chose the visual for that channel.

## Selection Source

- `inferred`
  The system selected the best approved candidate automatically.
- `channel_default`
  The system used an approved master that already matches the default channel format.
- `manual`
  An admin overrode the visual choice.

## Placement Coverage Model

Placement coverage is derived server-side and currently supports:

### Email

- `email_primary`

### Push

- `push_primary`

### WhatsApp

- `whatsapp_primary`

### Meta

- `meta_feed_square`
- `meta_feed_portrait`
- `meta_story_vertical`

### Google

- `google_display_landscape`
- `google_display_square`

### Landing

- `landing_hero`
- `landing_secondary_banner`

Each placement definition includes:

- required format
- preferred dimensions
- acceptable fallback formats
- whether fallback is allowed
- whether missing or fallback should block assisted export/publish
- handoff naming for manifests and ZIP structure

## Placement Readiness States

- `ready_exact`
  Exact approved coverage for the placement.
- `ready_fallback`
  Approved fallback coverage is acceptable for this placement.
- `partial`
  Coverage exists but is weaker than the expected placement target.
- `missing`
  No approved creative is available for the placement.
- `manual_override`
  The placement is effectively covered by a manually selected channel bundle.
- `blocked`
  Coverage exists only as a non-acceptable fallback, or the placement requires an exact asset before paid/export handoff.

## Current Placement Rules

### Email

- `email_primary`
  Prefers `landscape`
  Can fall back to `custom`
  Missing blocks handoff

### Push

- `push_primary`
  Prefers `square`
  Can fall back to `portrait`
  Missing blocks handoff

### WhatsApp

- `whatsapp_primary`
  Prefers `portrait`
  Can fall back to `story` or `square`
  Missing blocks handoff

### Meta

- `meta_feed_square`
  Requires exact `square`
- `meta_feed_portrait`
  Requires exact `portrait`
- `meta_story_vertical`
  Prefers `story`, can fall back to `portrait`

### Google

- `google_display_landscape`
  Requires exact `landscape`
- `google_display_square`
  Requires exact `square`

### Landing

- `landing_hero`
  Requires exact `landscape`
- `landing_secondary_banner`
  Prefers `custom`, can fall back to `landscape`

## Resolution Rules

### Channel bundle resolution

1. Prefer an approved derivative with the exact required format.
2. If none exists, use an approved master with the exact required format.
3. If none exists, use an approved fallback format when the channel allows it.
4. If nothing approved is usable, mark the bundle as `missing`.
5. Manual override always wins until it is cleared or becomes ineligible.

### Placement resolution

1. Respect a valid manual channel override first.
2. Reuse the current selected channel bundle asset if it exactly matches the placement.
3. If needed, infer another approved exact asset for that placement.
4. Use fallback only when the placement explicitly allows it.
5. Mark `blocked` or `missing` honestly when the placement policy requires more precise coverage.

## Admin Workflow

From `/admin/campaigns/[id]`, the team can now:

- inspect channel bundle coverage
- inspect placement coverage under each channel
- see which asset is resolving each placement
- distinguish exact, fallback, manual, blocked, and missing states
- keep manual bundle overrides traceable
- open JSON export or ZIP download per channel and per placement

## Integration With Export / Download

Creative bundles now feed:

- channel-level export packages
- placement-level export packages
- channel ZIP bundles
- placement ZIP bundles
- campaign ZIP bundles
- export-only paid media payloads

The bundle layer does not auto-publish visuals externally.

## Activity Feed

Campaign activity can now include:

- `creative_bundle_resolved`
- `creative_bundle_manual_override`
- `creative_bundle_cleared`
- `creative_bundle_missing_detected`
- `creative_bundle_ready`
- `placement_readiness_evaluated`
- `placement_missing_detected`
- `placement_export_generated`
- `placement_bundle_downloaded`

## Current Limitations

- placement coverage is still rule-based, not performance-optimized
- copy is still resolved at channel level and inherited by placements
- there is no placement-specific copy authoring yet
- Meta and Google are still export-only in this phase
- no placement-level external draft creation exists yet

## Natural Next Steps

- add per-placement copy overrides when paid teams need them
- connect placement readiness to future paid draft creation
- add more placement presets as paid media requirements grow
- let analytics and winner selection use placement-level delivery data when available
