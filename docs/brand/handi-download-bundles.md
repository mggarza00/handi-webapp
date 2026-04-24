# Handi Download Bundles

## Goal

Download bundles are the operational ZIP artifact for handing off approved copy + visuals from Handi to an execution team.

They are designed for:

- paid media handoff
- manual ops handoff
- external execution prep without exposing admin access

They are not a publishing mechanism.

## Bundle Types

- campaign bundle ZIP
- channel bundle ZIP
- placement bundle ZIP

## What A Bundle Contains

### Placement bundle

- `manifest.json`
- `README.txt`
- `copy.json`
- `draft-meta.json` or `draft-google.json` when applicable
- `assets/<selected-placement-file>`

### Channel bundle

- `manifest.json`
- `README.txt`
- `copy.json`
- `draft-meta.json` or `draft-google.json` when applicable
- `assets/<selected-channel-file>` when available
- `placements/<handoff-name>/manifest.json`
- `placements/<handoff-name>/README.txt`
- `placements/<handoff-name>/copy.json`
- `placements/<handoff-name>/assets/<selected-placement-file>` when available

### Campaign bundle

- `manifest.json`
- `README.txt`
- `campaign-summary.json`
- `drafts/<channel>-paid-draft.json` when applicable
- `channels/<channel>/manifest.json`
- `channels/<channel>/README.txt`
- `channels/<channel>/copy.json`
- `channels/<channel>/assets/<selected-channel-file>` when available
- `channels/<channel>/placements/<handoff-name>/manifest.json`
- `channels/<channel>/placements/<handoff-name>/README.txt`
- `channels/<channel>/placements/<handoff-name>/copy.json`
- `channels/<channel>/placements/<handoff-name>/assets/<selected-placement-file>` when available

## Manifest Content

The manifest is the operational source of truth for handoff.

It includes:

- campaign identifiers
- title
- audience
- goal
- service category
- offer
- CTA
- selected message/variant
- selected placement copy source and ids when applicable
- selected visual asset or placement asset
- dimensions and format
- paid handoff block with operational naming, copy treatment, and warnings
- readiness state
- provider metadata summary
- warnings
- tracking contract summary
- generated timestamp

## Download Rules

### Placement bundle

- `ready_exact`
  Allowed
- `ready_fallback`
  Allowed with warnings
- `manual_override`
  Allowed with warnings
- `blocked`
  Allowed only if a selected asset still exists for manual handoff
- `missing`
  Blocked

### Channel bundle

Channel ZIP generation is blocked only when:

- no selected channel asset exists
- and no placement has enough real coverage to export honestly

Channel ZIP generation is allowed with warnings when:

- some placements are blocked or missing
- the channel is fallback/manual/partial
- copy selection is incomplete
- a placement still inherits channel-level copy instead of an approved placement-specific override

### Campaign bundle

Campaign ZIP generation is allowed when at least one channel can be exported honestly.
Blocked channels stay listed in the root manifest and are omitted from the bundled channel folders.

## Storage Handling

Creative assets remain in private storage.

The server:

- downloads the needed binaries internally
- injects them into the ZIP
- returns only the final ZIP artifact to the admin

This keeps storage private while still producing a practical handoff package.

## Placement-Aware Handoff

For Meta, Google, and Landing, the ZIP now carries placement-specific subfolders so operations can see:

- which asset resolves each placement
- which copy resolves each placement
- whether that copy is inherited, AI-generated, or manually overridden
- whether the placement is exact, fallback, manual, blocked, or missing
- what filename is suggested for paid setup
- which tracking metadata belongs to that placement

Each placement or channel ZIP now also includes a small `README.txt` aimed at paid ops, with:

- platform and operational placement name
- current copy source
- exact vs fallback visual coverage
- readiness summary
- warnings that should be checked before trafficking

For Meta and Google, the ZIP also includes a paid draft JSON so the operator gets both:

- generic Campaign OS manifest
- platform-oriented draft payload

## Activity Feed

Bundle-related activity now includes:

- `creative_bundle_download_generated`
- `creative_bundle_downloaded`
- `creative_bundle_download_blocked`
- `creative_bundle_download_warning_emitted`
- `placement_bundle_downloaded`
- `paid_handoff_exported`
- `paid_placement_ready`
- `paid_placement_warning_emitted`
- `paid_draft_included_in_bundle`

## Current Limitations

- bundles are generated on demand; there is no stored artifact registry yet
- the same asset may appear more than once if it resolves multiple placements
- there is no PDF/contact-sheet output yet
- no video assets are included in this phase
- placement copy does not have its own version table yet; audit history lives in the campaign activity feed

## Natural Next Steps

- add alternate asset packing for A/B handoff
- add optional static preview/contact sheets
- store downloadable artifacts with TTL/version metadata if ops needs durable exports
- connect bundle selection with future external draft creation when enabled
