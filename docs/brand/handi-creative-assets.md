# Handi Creative Assets

## Goal

Handi now treats campaign creatives as part of the same internal operating system as copy.

The workflow stays inside the repo and admin panel:

- the team creates a visual brief from an approved or in-review campaign
- the system generates static image variants through a provider abstraction
- every asset is persisted, versioned, reviewable, and linked back to the campaign
- admin remains the only approval gate
- no visual asset is auto-published in this phase

## Scope

This phase covers:

- static campaign images only
- visual briefs derived from campaign strategy and copy
- provider abstraction with safe mock fallback
- storage and preview of generated assets
- master-to-derivative adaptation flows
- channel bundle resolution for publish/export payloads
- version history
- feedback and regeneration
- admin review and approval

This phase does not cover:

- video
- automatic resizing/adaptation across all formats
- visual publishing to external channels
- design-tool sync

## Data Model

### `creative_asset_jobs`

Stores the visual brief and review container for a campaign-linked generation request.

Includes:

- campaign linkage
- optional campaign message linkage
- channel
- provider and mode
- brief summary
- rationale summary
- structured brief payload
- generation status
- actor and timestamps

### `creative_assets`

Stores the current version of each visual variant produced by a job.

Includes:

- variant label
- master vs derivative role
- parent asset linkage for derivatives
- format
- target channel and dimensions
- adaptation method
- storage path
- current prompt text
- current rationale
- current status
- provider metadata

### `creative_asset_versions`

Stores the version history of each asset.

Each regeneration writes a new version entry with:

- version number
- storage path
- prompt text
- rationale
- editor actor
- timestamp

### `creative_asset_feedback`

Stores review actions and notes:

- approve
- reject
- request_changes
- regenerate
- manual_edit

## Statuses

Creative jobs and assets currently use the same editorial-style statuses:

- `draft`
- `proposed`
- `changes_requested`
- `approved`
- `rejected`
- `archived`

## Provider Abstraction

Creative generation lives under `lib/creative/`.

Main entry points:

- `lib/creative/provider.ts`
- `lib/creative/adapt.ts`
- `lib/creative/bundles.ts`
- `lib/creative/formats.ts`
- `lib/creative/providers/mock.ts`
- `lib/creative/providers/image-provider.ts`

Supported operations today:

- `generateImageAssets`
- `regenerateImageAsset`
- local derivative adaptation from an approved master asset

### Current provider behavior

- `mock`
  Generates deterministic PNG assets inside the repo flow using a mock renderer.
- `image-provider`
  Uses a live image backend when config is present and falls back safely to mock when config or generation fails.

### Relevant env vars

- `HANDI_CREATIVE_PROVIDER`
- `HANDI_CREATIVE_IMAGE_API_KEY`
- `HANDI_CREATIVE_IMAGE_MODEL`
- `HANDI_CREATIVE_IMAGE_QUALITY`
- `HANDI_CREATIVE_IMAGE_BACKGROUND`
- `HANDI_CREATIVE_IMAGE_MODERATION`
- `HANDI_CREATIVE_IMAGE_OUTPUT_FORMAT`
- `OPENAI_API_KEY`

## Brief Flow

The visual brief is derived from:

- campaign strategy
- audience
- goal
- channel
- optional linked copy variant
- service category
- offer
- CTA
- optional admin notes
- brand visual guardrails

Core modules:

- `lib/creative/brief.ts`
- `lib/creative/prompts.ts`
- `lib/creative/brand-visual-guards.ts`

The brief payload includes:

- `visualPrompt`
- `briefSummary`
- `rationaleSummary`
- `targetFormat`
- `compositionNotes`
- `visualConstraints`
- `textOverlayGuidance`

## Brand Visual Rules

The pipeline reuses Handi brand rules instead of redefining them in the UI.

Key principles:

- trust-first visual hierarchy
- practical, human service contexts
- restrained text inside the asset
- clean editorial composition
- deep blue, light blue, cream, and black as the base palette
- visuals should support clarity, not overpower the message

## Storage

Assets are stored in the private Supabase bucket:

- `campaign-creative-assets`

Path convention:

- `campaigns/{campaignId}/creative/{jobId}/{assetId}/v{n}-{format}.{ext}`

The bucket stays private.
Admin previews are served through signed URLs generated server-side.

The SQL migration does not create the bucket directly. The runtime helper creates it with the service-role client on first upload, or it can be created manually from the Supabase Storage UI with the same name.

When live generation is active, Handi still uploads the final binary to its own private bucket. Provider URLs are never treated as the final source of truth.

Provider metadata classifies fallback causes so the admin can distinguish configuration, provider, response, and storage failures without leaving Handi.

## Admin Flow

### Create

From `/admin/campaigns/[id]` the team can:

- create a campaign-level visual brief
- optionally link the brief to a specific copy variant
- choose target format
- request multiple image variants

### Review

From `/admin/creative-assets` the team can:

- filter by status
- filter by channel
- filter by provider
- open the job detail

### Detail

From `/admin/creative-assets/[id]` the team can:

- inspect the brief summary
- inspect rationale summary
- review provider metadata
- preview all current variants
- compare original vs current versions
- inspect prompt text
- inspect rationale
- approve
- reject
- request changes
- regenerate from feedback
- create derivatives from approved masters
- inspect derivative previews and version history

From `/admin/campaigns/[id]` the team can also:

- inspect creative coverage per publishable channel
- see which selected copy and approved visual will travel together in payload preparation
- override the selected visual manually for a channel
- clear the override and return to inferred selection
- spot missing or partial visual coverage before export or assisted publish

## Adaptation Flow

An approved master can now produce derivative assets for:

- `square`
- `portrait`
- `landscape`
- `story`
- `custom`

Current adaptation methods:

- `crop`
- `pad`
- `resize`

The pipeline also records future-facing method intents:

- `ai_extend`
- `provider_regenerate`

In this phase, those future-facing method requests degrade safely to a local adaptation path and record that downgrade in metadata.

## Activity Feed

Campaign activity now includes creative-specific events:

- `creative_asset_job_created`
- `creative_asset_generated`
- `creative_asset_regenerated`
- `creative_asset_approved`
- `creative_asset_rejected`
- `creative_asset_changes_requested`
- `creative_asset_version_created`
- `creative_asset_adaptation_created`
- `creative_asset_adaptation_regenerated`
- `creative_asset_adaptation_approved`
- `creative_asset_adaptation_rejected`
- `creative_asset_adaptation_changes_requested`
- `creative_bundle_resolved`
- `creative_bundle_manual_override`
- `creative_bundle_cleared`
- `creative_bundle_missing_detected`
- `creative_bundle_ready`

This keeps creative work visible from the campaign detail page instead of splitting text and visual review into separate systems.

## Current Limitations

- the `image-provider` abstraction can run live, but still depends on correct env config and storage availability
- adaptation is currently local/server-side, not AI outpainting
- no video pipeline yet
- no external visual publishing yet
- no automatic multiformat adaptation yet
- no manual pixel-level editing inside Handi yet
- assets are reviewed as stored versions, not as layered design files
- bundle resolution is deterministic and channel-based, not placement-aware yet

## Natural Next Steps

- improve derivative coverage rules per channel
- add stricter readiness checks for channels that require exact visual coverage
- add lightweight manual override tools for crop and overlay notes
- connect selected creative bundles into future visual publishing or CMS placement
- prepare the asset model for future video jobs without breaking the current image workflow
