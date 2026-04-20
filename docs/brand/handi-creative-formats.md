# Handi Creative Formats

## Goal

Handi can now derive multiple approved image formats from a master creative asset without leaving the internal review workflow.

This phase adds a clear `master -> derivative` model so the team can:

- approve a master asset
- derive reusable formats from it
- review each derivative separately
- keep version history and storage inside Handi

## Supported Formats

Current presets live in `lib/creative/formats.ts`.

- `square`: `1080x1080`
- `portrait`: `1080x1350`
- `landscape`: `1200x628`
- `story`: `1080x1920`
- `custom`: explicit width and height

## Default Channel Mapping

Current recommended defaults are conservative:

- `meta` -> `square`
- `email` -> `landscape`
- `whatsapp` -> `portrait`
- `push` -> `square`
- `landing` -> `landscape`
- `google` -> `landscape`

This mapping is used as decision support.
It now feeds creative bundle resolution for channel payload preparation.
It still does not auto-publish a final visual externally.

## Adaptation Methods

The pipeline supports these methods in the data model:

- `crop`
- `pad`
- `resize`
- `ai_extend`
- `provider_regenerate`

### What is real in this phase

The current execution path is local and server-side using `sharp`:

- `crop`
  Resizes with cover and attention-aware cropping.
- `pad`
  Resizes with contain and adds neutral background padding.
- `resize`
  Applies direct resize to the target frame.

### What is prepared for later

- `ai_extend`
- `provider_regenerate`

These are accepted as intent, but currently fall back to a local adaptation path with explicit metadata so the team can see what actually happened.

## Data Model

This phase extends the existing creative tables instead of creating a separate derivative table.

### `creative_asset_jobs`

Adds operational fields such as:

- `job_type`
- `parent_creative_asset_id`
- `target_channel`
- `target_width`
- `target_height`
- `adaptation_method`

### `creative_assets`

Adds asset-level derivative linkage:

- `asset_role`
- `parent_asset_id`
- `target_channel`
- `target_width`
- `target_height`
- `adaptation_method`
- `channel_suitability`

### `creative_asset_versions`

Each derivative version now stores:

- `format`
- `target_channel`
- `target_width`
- `target_height`
- `adaptation_method`
- `channel_suitability`

## Workflow

1. The team approves a master creative asset.
2. From admin, the team requests a derivative format.
3. Handi reads the approved asset from private storage.
4. Handi applies the local adaptation method.
5. Handi stores the derivative in the same private bucket.
6. Handi creates a dedicated adaptation job and version history.
7. Admin reviews the derivative like any other creative asset.

## Review Model

Derivatives remain inside the same editorial statuses:

- `proposed`
- `changes_requested`
- `approved`
- `rejected`
- `archived`

Approval of a derivative does not auto-approve any publish action.

## Storage

Derived assets use the same private bucket:

- `campaign-creative-assets`

They follow the same versioned storage pattern as master assets.

## Activity Feed

The campaign activity feed now distinguishes derivative work:

- `creative_asset_adaptation_created`
- `creative_asset_adaptation_regenerated`
- `creative_asset_adaptation_approved`
- `creative_asset_adaptation_rejected`
- `creative_asset_adaptation_changes_requested`

## Current Limitations

- no video adaptation
- no provider-assisted outpainting yet
- bundle selection is channel-level, not placement-level
- no external visual publish step yet
- no interactive crop UI yet

## Natural Next Steps

- add provider-assisted expansion for story-safe and banner-safe adaptations
- add manual crop focal-point controls in admin
- refine bundle rules by placement and channel subtype
- add derivative coverage rules per channel before visual publishing begins
