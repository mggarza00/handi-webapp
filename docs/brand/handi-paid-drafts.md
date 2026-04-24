# Handi Paid Drafts

## Goal

Paid drafts are export-only payloads that sit between the generic export package and a future direct Meta/Google draft API integration.

They are designed for:

- media buyers
- paid ops handoff
- manual trafficking with stronger structure than the generic package

They do not publish live.

## Difference vs Generic Export Package

### Generic export package

The generic package is Campaign OS oriented. It exposes:

- campaign context
- resolved copy
- creative bundle metadata
- readiness
- tracking contract

### Paid draft

The paid draft is operator oriented. It reorganizes the same resolved data into a structure closer to how a paid channel is set up manually:

- campaign name
- placement/export target
- copy fields ready for trafficking
- selected asset and filename
- readiness/warnings
- internal IDs
- UTM and tracking payload
- notes for the media buyer

## Supported Platforms

### Meta

Current placement-aware draft output covers:

- `meta_feed_square`
- `meta_feed_portrait`
- `meta_story_vertical`
- `meta_reel_vertical`
- `meta_right_column_landscape`

### Google

Current placement-aware draft output covers:

- `google_display_landscape`
- `google_display_square`
- `google_responsive_display_landscape`
- `google_responsive_display_square`

## Draft Shapes

### Placement draft

Every placement draft includes:

- campaign metadata
- placement metadata
- resolved copy
- selected asset
- readiness and warnings
- internal IDs
- tracking contract
- platform-specific payload block

### Channel draft

Every paid channel draft includes:

- campaign metadata
- aggregated placement drafts
- summary counts for ready/warning/blocked placements
- channel-level tracking contract
- operator notes

## Meta Draft Payload

Meta drafts currently expose:

- `campaign_name`
- `ad_set_notes`
- `placement`
- `ad.headline`
- `ad.primary_text`
- `ad.cta`
- `asset`
- `utm_tracking`
- `custom_tracking`
- `warnings`

## Google Draft Payload

Google drafts currently expose:

- `campaign_name`
- `ad_group_notes`
- `export_target`
- `ad.headline`
- `ad.description`
- `ad.cta`
- `asset`
- `utm_tracking`
- `custom_tracking`
- `warnings`

## Internal IDs And Tracking

Paid drafts stay aligned with the existing tracking contracts and carry:

- `campaign_id`
- `channel`
- `placement_id`
- `message_id`
- `placement_copy_id`
- `creative_asset_id`
- `derivative_asset_id`
- bundle/readiness state
- UTM mapping

This is meant to keep future GA4/Clarity correlation and future draft/live integrations consistent with Campaign OS.

## Admin Access

From `/admin/campaigns/[id]`, paid channels and paid placements now expose:

- view paid draft
- download paid draft

ZIP bundles for paid channels/placements also include `draft-meta.json` or `draft-google.json` when applicable.

## Activity Feed

Paid draft operations emit:

- `paid_draft_generated`
- `paid_draft_downloaded`
- `paid_draft_warning_emitted`
- `paid_draft_blocked`
- `paid_draft_included_in_bundle`

## Current Limitations

- these drafts are still export-only
- they do not model the full Meta or Google APIs
- there is no external draft push yet
- headlines/bodies are still derived from the Campaign OS message model, not a fully native ad-builder model
- targeting is still represented as notes, not platform-native audience objects

## Natural Next Steps

- connect these draft shapes to future draft API integrations
- add richer placement-specific field constraints only where ops needs them
- introduce more explicit media-buyer notes around targeting and naming conventions
